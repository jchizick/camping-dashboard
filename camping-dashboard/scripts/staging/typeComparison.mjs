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
    expectedSha256:hash(expected),actualSha256:hash(actual),expectedSemanticSha256:hash(a),actualSemanticSha256:hash(b)};
}
