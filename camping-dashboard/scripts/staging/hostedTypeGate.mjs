import ts from 'typescript';
import {compareTypes,hash,describeTypeDifferences} from './typeComparison.mjs';

export const POSTGREST_VERSION='14.5';
export const CONSTRAINTS=Object.freeze({Tables:'TableName',TablesInsert:'TableName',TablesUpdate:'TableName',Enums:'EnumName',CompositeTypes:'CompositeTypeName'});
const name=n=>n?.name&&(ts.isIdentifier(n.name)||ts.isStringLiteral(n.name))?n.name.text:null;
// AST tree shape preserves precedence: (A | B)[] is not A | B[]. Only
// ParenthesizedType wrappers disappear, and only inside the five named nodes.
function expression(node){
 if(ts.isParenthesizedTypeNode(node))return expression(node.type);
 const attributes={};
 for(const key of ['text','escapedText','operator','isTypeOf','isTypeOnly'])
  if(node[key]!==undefined)attributes[key]=node[key];
 const children=[];ts.forEachChild(node,child=>{children.push(expression(child));});
 return [node.kind,attributes,children];
}
function prepare(text,hosted){
 const source=ts.createSourceFile('artifact.ts',text,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
 if(source.parseDiagnostics.length)throw Error('TYPE_ARTIFACT_PARSE_FAILED');
 const databases=source.statements.filter(s=>ts.isTypeAliasDeclaration(s)&&s.name.text==='Database');
 const db=databases.length===1&&ts.isTypeLiteralNode(databases[0].type)?databases[0]:null;
 const members=db?.type.members.filter(m=>name(m)==='__InternalSupabase')??[];
 let code=hosted?'POSTGREST_METADATA_MISSING':'LOCAL_CAPABILITY_METADATA_NOT_APPLICABLE',value=null;
 if(members.length){
  code='POSTGREST_VERSION_INVALID';
  const member=members[0];
  if(members.length===1&&ts.isPropertySignature(member)&&!member.questionToken&&!member.modifiers?.length&&member.type&&ts.isTypeLiteralNode(member.type)&&member.type.members.length===1){
   const version=member.type.members[0];
   if(ts.isPropertySignature(version)&&name(version)==='PostgrestVersion'&&!version.questionToken&&!version.modifiers?.length&&version.type&&ts.isLiteralTypeNode(version.type)&&ts.isStringLiteral(version.type.literal)){
    value=version.type.literal.text;
    code=/^\d+\.\d+$/.test(value)?value===POSTGREST_VERSION?'POSTGREST_CAPABILITY_PASS':'POSTGREST_VERSION_MISMATCH':'POSTGREST_VERSION_INVALID';
   }
  }
 }
 const capability={verdict:code,path:'Database.__InternalSupabase.PostgrestVersion',expected:hosted?POSTGREST_VERSION:'absent or '+POSTGREST_VERSION,actual:value,contract:'capability metadata'};
 const constraints={};
 const transformed=ts.transform(source,[context=>node=>ts.visitEachChild(node,statement=>{
  if(!ts.isTypeAliasDeclaration(statement))return statement;
  let updated=statement;
  if(statement===db&&members.length){
   updated=ts.factory.updateTypeAliasDeclaration(updated,updated.modifiers,updated.name,updated.typeParameters,
    ts.factory.updateTypeLiteralNode(db.type,db.type.members.filter(m=>name(m)!=='__InternalSupabase')));
  }
  const parameterName=CONSTRAINTS[statement.name.text];
  if(parameterName&&updated.typeParameters){
   const parameters=updated.typeParameters.map(p=>{
    if(p.name.text!==parameterName||!p.constraint)return p;
    const path=statement.name.text+'.typeParameters.'+parameterName+'.constraint';
    if(constraints[path])throw Error('TYPE_CONSTRAINT_DUPLICATE');
    const semantic=JSON.stringify(expression(p.constraint));constraints[path]=semantic;
    return ts.factory.updateTypeParameterDeclaration(p,p.modifiers,p.name,ts.factory.createLiteralTypeNode(ts.factory.createStringLiteral(semantic)),p.default);
   });
   updated=ts.factory.updateTypeAliasDeclaration(updated,updated.modifiers,updated.name,parameters,updated.type);
  }
  return updated;
 },context)]);
 const structural=ts.createPrinter({removeComments:true}).printFile(transformed.transformed[0]);transformed.dispose();
 return {structural,capability,constraints};
}
export function compareHostedTypes(expected,actual){
 const a=prepare(expected,false),b=prepare(actual,true);
 const comparison=compareTypes(a.structural,b.structural);
 const constraintResults=[...new Set([...Object.keys(a.constraints),...Object.keys(b.constraints)])].sort().map(path=>({path,equivalent:a.constraints[path]===b.constraints[path]}));
 const structure=constraintResults.some(r=>!r.equivalent)?'TYPE_CONSTRAINT_DIFFERENCE':comparison.equivalent?'TYPE_STRUCTURE_EQUIVALENT':'TYPE_STRUCTURE_DIFFERENCE';
 const baselineCapabilityValid=['LOCAL_CAPABILITY_METADATA_NOT_APPLICABLE','POSTGREST_CAPABILITY_PASS'].includes(a.capability.verdict);
 const equivalent=structure==='TYPE_STRUCTURE_EQUIVALENT'&&baselineCapabilityValid&&b.capability.verdict==='POSTGREST_CAPABILITY_PASS';
 const capability=b.capability;
 const verdict=equivalent?'HOSTED_TYPE_GATE_PASS':!baselineCapabilityValid?a.capability.verdict:capability.verdict!=='POSTGREST_CAPABILITY_PASS'?capability.verdict:structure;
 const differences=describeTypeDifferences(expected,actual).filter(d=>!constraintResults.some(c=>c.path===d.path&&c.equivalent)).map(d=>({...d,contract:d.path.startsWith('Database.__InternalSupabase')?'capability metadata':'database contract'}));
 return {equivalent,typeVerdict:verdict,structure,capability,baselineCapability:a.capability,constraintResults,differences,expectedSha256:hash(expected),actualSha256:hash(actual)};
}
