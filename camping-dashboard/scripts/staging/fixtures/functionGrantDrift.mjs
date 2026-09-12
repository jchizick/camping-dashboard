// Synthetic ACL-only discrepancy; no hosted content, function bodies or user data.
export const signatures=['public.claim_trip_alerts_manual(text,text,integer,integer)','public.claim_trip_weather_manual(text,text,integer,integer)','public.create_trip(text,date,date,double precision,double precision,text,text,text,text,text,text)'];
export const baseline=signatures.flatMap(key=>[['function-grant',key+'.postgres.EXECUTE',false],['function-grant',key+'.authenticated.EXECUTE',false]]);
export const hostedStyle=[...baseline,...signatures.map(key=>['function-grant',key+'.service_role.EXECUTE',false])];
