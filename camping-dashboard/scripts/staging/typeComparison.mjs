// Conservative structural comparison; no network or application-source writes.
import ts from 'typescript';
import {createHash} from 'node:crypto';
export const hash = text => createHash('sha256').update(text).digest('hex');
export function canonicalTypes(text) {
  const source=ts.createSourceFile('generated.ts',text,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
  if(source.parseDiagnostics.length) throw new Error('TYPE_ARTIFACT_PARSE_FAILED');
  const printer=ts.createPrinter({removeComments:true,newLine:ts.NewLineKind.LineFeed});
  const key=n=>n.name && (ts.isIdentifier(n.name)||ts.isStringLiteral(n.name)) ? n.name.text : null;
  const result=ts.transform(source,[context=>{
    const visit=node=>{
      let next=ts.visitEachChild(node,visit,context);
      // Property order is irrelevant; overloads, tuples and parameter order are not.
      if(ts.isTypeLiteralNode(next) && next.members.every(ts.isPropertySignature)) {
        const keys=next.members.map(key);
        if(keys.every(k=>k!==null)&&new Set(keys).size===keys.length)
          next=ts.factory.updateTypeLiteralNode(next,[...next.members].sort((a,b)=>key(a)<key(b)?-1:key(a)>key(b)?1:0));
      }
      return next;
    };
    return visit;
  }]);
  const normalized=printer.printFile(result.transformed[0]);
  result.dispose();
  // The scanner removes formatting without altering literal contents or token order.
  const scanner=ts.createScanner(ts.ScriptTarget.Latest,true,ts.LanguageVariant.Standard,normalized);
  const tokens=[];
  for(let token=scanner.scan();token!==ts.SyntaxKind.EndOfFileToken;token=scanner.scan())
    tokens.push([token,scanner.getTokenText()]);
  return JSON.stringify(tokens);
}
export function compareTypes(expected,actual) {
  const a=canonicalTypes(expected),b=canonicalTypes(actual);
  return {equivalent:a===b,classification:a===b?'NON_SEMANTIC_BASELINE_EQUIVALENT':'TYPE_CONTRACT_DIFFERENCE_REQUIRES_REVIEW',
    expectedSha256:hash(expected),actualSha256:hash(actual),expectedSemanticSha256:hash(a),actualSemanticSha256:hash(b),
    differences:a===b?[]:describeTypeDifferences(expected,actual),
    capabilityVerdict:'LOCAL_CAPABILITY_METADATA_NOT_APPLICABLE'};
}

// Diagnostic only: never used to authorize equivalence or omit gate inputs.
export function describeTypeDifferences(expected,actual) {
 const flatten=text=>{
  const source=ts.createSourceFile('evidence.ts',text,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
  if(source.parseDiagnostics.length)throw new Error('TYPE_ARTIFACT_PARSE_FAILED');
  const values=new Map();
  const put=(path,node)=>{
   if(values.has(path))throw new Error('TYPE_EVIDENCE_DUPLICATE_PATH');
   values.set(path,node.getText(source));
  };
  const walk=(path,node)=>{
   if(ts.isTypeLiteralNode(node)&&node.members.length&&node.members.every(m=>ts.isPropertySignature(m)&&m.type&&m.name&&(ts.isIdentifier(m.name)||ts.isStringLiteral(m.name)))){
    for(const m of node.members){const child=path+'.'+m.name.text;
     if(m.questionToken)put(child+'.optional',m.questionToken);
     if(m.modifiers?.length)for(const modifier of m.modifiers)put(child+'.modifier.'+ts.SyntaxKind[modifier.kind],modifier);
     walk(child,m.type);
    }
   }else put(path,node);
  };
  let otherIndex=0;
  for(const statement of source.statements){
   if(ts.isTypeAliasDeclaration(statement)){
    walk(statement.name.text,statement.type);
    for(const parameter of statement.typeParameters??[]){
     const path=statement.name.text+'.typeParameters.'+parameter.name.text;
     if(parameter.constraint)put(path+'.constraint',parameter.constraint);
     if(parameter.default)put(path+'.default',parameter.default);
    }
   }else put('statement.'+otherIndex++,statement);
  }
  return values;
 };
 const a=flatten(expected),b=flatten(actual);
 const category=path=>path.includes('.Relationships')?'RELATIONSHIP_METADATA':path.includes('.Tables.')?'TABLE_SHAPE':path.includes('.Functions.')?'FUNCTION_TYPE':path.includes('.Views.')?'VIEW':/\.(Enums|CompositeTypes)\./.test(path)?'ENUM_COMPOSITE':'GENERATOR_METADATA_REPRESENTATION';
 // Compare leaf syntax with the same conservative canonicalizer; parentheses
 // remain visible in evidence and are NOT silently accepted by the type gate.
 const canonical=(value,path)=>value===undefined?null:['?','readonly'].includes(value)?value:canonicalTypes(path.startsWith('statement.')?value:'type Evidence = '+value);
 return [...new Set([...a.keys(),...b.keys()])].sort().filter(path=>canonical(a.get(path),path)!==canonical(b.get(path),path)).map(path=>({path,expected:a.get(path)??null,actual:b.get(path)??null,classification:category(path)}));
}
