$ErrorActionPreference='Stop'
Import-Module (Join-Path $PSScriptRoot 'credentialDiscovery.psm1') -Force
$ref='mgnkvfohpqixgacszovv'
$passed=0
function Check($condition,[string]$message) { if(-not $condition){throw $message} }
function Test([string]$name,[scriptblock]$body) { & $body; $script:passed++; Write-Output ('PASS '+$name) }
function Fixture {
  param([hashtable]$Options=@{})
  $ctx=@{reads=[Collections.Generic.List[string]]::new();requests=[Collections.Generic.List[string]]::new();writes=@{};tokens=[Collections.Generic.List[string]]::new();options=$Options}
  $reader={param($name)
    $ctx.reads.Add($name)
    if($name -eq 'read-setup-token.dpapi'){if($ctx.options.missingToken){throw 'SENTINEL_SECRET'};return 'SENTINEL_SETUP_TOKEN'}
    if($name -eq 'staging-db-password.dpapi'){return 'SENTINEL_PASSWORD:/?#'}
    if($name -eq 'rate-secret.dpapi'){if($ctx.options.corruptRate){throw 'SENTINEL_SECRET'};if($ctx.options.missingRate){return $null};return 'SENTINEL_RATE_SECRET_12345678901234567890'}
    throw 'Management credential must never be requested'
  }.GetNewClosure()
  $writer={param($name,$value) if($ctx.options.storageFailure){throw ('SENTINEL_SECRET '+$value)};$ctx.writes[$name]=$value}.GetNewClosure()
  $request={param($path,$token)
    $ctx.requests.Add($path);$ctx.tokens.Add($token)
    if($ctx.options.httpFailure){throw 'SENTINEL_SECRET_RAW_HTTP'}
    if($path.EndsWith('/api-keys?reveal=true')){
      if($ctx.options.emptyKeys){return}
      if($ctx.options.duplicateModern){[pscustomobject]@{name='other';type='publishable';api_key='sb_publishable_SENTINEL_OTHER'}}
      foreach($role in @('anon','service_role')){
        if($ctx.options.modernOnly){continue}
        if($ctx.options.missingService -and $role -eq 'service_role'){continue}
        $keyRef=if($ctx.options.wrongKeyRef){'gdsmyxzqtmhwbcyobzou'}else{'mgnkvfohpqixgacszovv'}
        $claims=@{ref=$keyRef;role=$role}|ConvertTo-Json -Compress
        $encoded=[Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($claims)).TrimEnd('=').Replace('+','-').Replace('/','_')
        [pscustomobject]@{name=$role;type='legacy';api_key='e30.'+$encoded+'.SENTINEL_SIGNATURE'}
      }
      if(-not $ctx.options.legacyOnly){[pscustomobject]@{name='default';type='publishable';api_key=if($ctx.options.badPrefix){'sb_secret_SENTINEL_WRONG'}elseif($ctx.options.newlineKey){'sb_publishable_SENTINEL_PUBLIC'+[char]10}else{'sb_publishable_SENTINEL_PUBLIC'}}}
      if(-not $ctx.options.legacyOnly -and -not $ctx.options.missingModernSecret){[pscustomobject]@{name='default';type='secret';api_key='sb_secret_SENTINEL_SECRET'}}
    } elseif($path.EndsWith('/pooler')) {
      if($ctx.options.missingPooler){return}
      $hostName=if($ctx.options.wrongHost){'attacker.example'}else{'aws-9-ca-central-1.pooler.supabase.com'}
      $userName=if($ctx.options.wrongPoolerUser){'postgres.gdsmyxzqtmhwbcyobzou'}else{'postgres.mgnkvfohpqixgacszovv'}
      $sourcePort=if($ctx.options.transactionOnly){6543}else{5432}
      $connection='postgresql://'+$userName+':[YOUR-PASSWORD]@'+$hostName+':'+$sourcePort+'/postgres'
      [pscustomobject]@{identifier='mgnkvfohpqixgacszovv';database_type='PRIMARY';db_host=$hostName;db_user=$userName;db_name='postgres';db_port=$sourcePort;pool_mode=if($ctx.options.transactionOnly){'transaction'}else{'session'};connection_string=$connection;connectionString=$connection;default_pool_size=$null;max_client_conn=$null;is_using_scram_auth=$true}
    } else {
      [pscustomobject]@{id=if($ctx.options.wrongIdentity){'rmfhueseulevyvetblnn'}else{'mgnkvfohpqixgacszovv'};name='field-protocol-staging';organization_id='qvhhhjlpntbtctqinayz';status=if($ctx.options.active){'ACTIVE_HEALTHY'}else{'INACTIVE'};database=@{host='db.mgnkvfohpqixgacszovv.supabase.co'}}
    }
  }.GetNewClosure()
  $rawRequest=$request
  $envelope={param($path,$token)
    $body=& $rawRequest $path $token
    if($path -match 'api-keys|/pooler$'){$body=@($body)}
    [pscustomobject]@{status=200;jsonValid=$true;body=$body}
  }.GetNewClosure()
  return @{ctx=$ctx;reader=$reader;writer=$writer;request=$envelope}
}
function Invoke-Fixture($f,[string]$Target='mgnkvfohpqixgacszovv') { Invoke-StagingCredentialDiscovery -Ref $Target -ReadSecret $f.reader -SaveSecret $f.writer -Request $f.request }
function Expect-Failure($f,[string]$Code,[string]$Target='mgnkvfohpqixgacszovv') {
  $captured=@(Invoke-Fixture $f $Target *>&1);$result=$captured[-1]
  Check (-not $result.ready -and $result.code -ceq $Code) ('Wrong failure code: '+$result.code)
  Check (($captured|ConvertTo-Json -Depth 8) -notmatch 'SENTINEL|postgresql://|sb_secret_|sb_publishable_') 'Secret exposed in result'
}
Test 'operation token separation' {
 foreach($op in @('discover','export','pooler')){Check ((Get-StagingTokenFile $op) -eq 'read-setup-token.dpapi') 'Wrong read token'}
 foreach($op in @('preflight','create','auth','plan','apply','verify')){Check ((Get-StagingTokenFile $op) -eq 'management-token.dpapi') 'Wrong management token'}
}
foreach($target in @('gdsmyxzqtmhwbcyobzou','rmfhueseulevyvetblnn','abcdefghijklmnopqrst')) {
 Test ('reject target '+$target) { $f=Fixture;Expect-Failure $f ($(if($target -eq 'abcdefghijklmnopqrst'){'STAGING_IDENTITY_MISMATCH'}else{'PROTECTED_PROJECT_TARGETED'})) $target;Check ($f.ctx.reads.Count -eq 0 -and $f.ctx.requests.Count -eq 0) 'Read occurred before target guard' }
}
Test 'missing setup token has no fallback or network read' { $f=Fixture @{missingToken=$true};Expect-Failure $f 'READ_PAT_UNAVAILABLE';Check ($f.ctx.requests.Count -eq 0) 'Unexpected network' }
Test 'remote identity rejects before sensitive read' { $f=Fixture @{wrongIdentity=$true};Expect-Failure $f 'STAGING_IDENTITY_MISMATCH';Check ($f.ctx.requests.Count -eq 1) 'Sensitive read occurred' }
Test 'active project is refused for paused-only discovery' { $f=Fixture @{active=$true};Expect-Failure $f 'STAGING_NOT_PAUSED' }
Test 'key reference mismatch stops storage' { $f=Fixture @{wrongKeyRef=$true};Expect-Failure $f 'LEGACY_KEY_INVALID';Check ($f.ctx.writes.Count -eq 0) 'Stored invalid keys' }
Test 'incomplete legacy pair cannot mix with incomplete modern pair' { $f=Fixture @{missingService=$true;missingModernSecret=$true};$r=Invoke-Fixture $f;Check (-not $r.ready) 'Mixed pair accepted';Check ($f.ctx.writes.Count -eq 0) 'Stored incomplete credentials' }
Test 'empty pooler response fails closed without credentials or guessed host' { $f=Fixture @{missingPooler=$true};$r=Invoke-Fixture $f;Check (-not $r.ready -and $r.code -eq 'POOLER_CONFIG_EMPTY') 'Wrong availability';Check ($f.ctx.writes.Count -eq 0) 'Stored guessed connection' }
Test 'pooler user rejects protected project' { $f=Fixture @{wrongPoolerUser=$true};Expect-Failure $f 'POOLER_PROJECT_MISMATCH' }
Test 'pooler host rejects untrusted destination' { $f=Fixture @{wrongHost=$true};Expect-Failure $f 'POOLER_HOST_INVALID' }
Test 'HTTP failure cannot log response secrets' { $f=Fixture @{httpFailure=$true};Expect-Failure $f 'METADATA_HTTP_FAILED' }
Test 'storage failure cannot report ready or expose values' { $f=Fixture @{storageFailure=$true};Expect-Failure $f 'SECURE_STORE_FAILED' }
Test 'unreadable existing rate secret is not silently replaced' { $f=Fixture @{corruptRate=$true};Expect-Failure $f 'DPAPI_READ_FAILED';Check ($f.ctx.writes.Count -eq 0) 'Replaced unreadable credential' }
Test 'absent optional rate secret is generated and encrypted' { $f=Fixture @{missingRate=$true};$r=Invoke-Fixture $f;Check ($r.ready -and $f.ctx.writes['rate-secret.dpapi'].Length -eq 64) 'Missing generated rate secret' }
Test 'successful result redacts secrets and preserves session TLS identity' {
 $f=Fixture;$captured=@(Invoke-Fixture $f *>&1);$r=$captured[-1]
 Check ($r.ready -and $r.port -eq 5432 -and $r.mode -eq 'session') 'Not ready'
 Check (($captured|Out-String) -notmatch 'SENTINEL|postgresql://|connection_string') 'Secret in output'
 Check (@($f.ctx.tokens|Where-Object {$_ -ne 'SENTINEL_SETUP_TOKEN'}).Count -eq 0) 'Wrong request token'
 Check (-not $f.ctx.reads.Contains('management-token.dpapi')) 'Management token read'
 Check ($f.ctx.requests.Count -eq 4 -and $f.ctx.requests[2] -eq ('/projects/'+$ref)) 'Identity not rechecked before pooler'
 $uri=[Uri]$f.ctx.writes['staging-db-url.dpapi'];Check ($uri.Port -eq 5432 -and $uri.Query -eq '?sslmode=verify-full' -and $uri.Host -eq $r.host) 'Unsafe URI'
 Check ($uri.UserInfo.EndsWith('SENTINEL_PASSWORD%3A%2F%3F%23')) 'Password not encoded'
 Check ($f.ctx.writes['staging-vercel-env.dpapi'].Contains('TRIP_INVITATIONS_ENABLED=false')) 'Delivery enabled'
 Check ($f.ctx.writes.Count -eq 5) 'Missing encrypted payload'
}
Test 'real encrypted storage round-trip and failure redaction' {
 $directory=Join-Path ([IO.Path]::GetTempPath()) ('fp-discovery-test-'+[Guid]::NewGuid().ToString('N'))
 $null=[IO.Directory]::CreateDirectory($directory)
 try {
  Write-StagingEncrypted $directory 'fixture.dpapi' 'SENTINEL_SECRET_STORAGE'
  Check ((Read-StagingEncrypted $directory 'fixture.dpapi') -ceq 'SENTINEL_SECRET_STORAGE') 'Round trip failed'
  Check (-not ([IO.File]::ReadAllText((Join-Path $directory 'fixture.dpapi'))).Contains('SENTINEL')) 'Plaintext on disk'
  $failed=$false;try {Write-StagingEncrypted (Join-Path $directory 'missing') 'fixture.dpapi' 'SENTINEL_SECRET_STORAGE'}catch{$failed=$true;Check ($_.Exception.Message -eq 'DISCOVERY_ENCRYPTED_STORAGE_FAILED') 'Unsafe storage error'};Check $failed 'Expected storage failure'
 } finally { if([IO.File]::Exists((Join-Path $directory 'fixture.dpapi'))){[IO.File]::Delete((Join-Path $directory 'fixture.dpapi'))};[IO.Directory]::Delete($directory) }
}
Test 'legacy-only pair accepted' { $f=Fixture @{legacyOnly=$true};$r=Invoke-Fixture $f;Check ($r.ready -and $r.publicSource -eq 'legacy anon') 'Legacy pair rejected' }
Test 'legacy preferred when both generations exist' { $f=Fixture;$r=Invoke-Fixture $f;Check ($r.publicSource -eq 'legacy anon' -and $r.serverSource -eq 'legacy service_role') 'Wrong preference' }
Test 'opaque modern pair accepted in active gate without JWT decoding or output' {
 $f=Fixture @{modernOnly=$true;active=$true}
 $captured=@(Invoke-StagingCredentialDiscovery -ExpectedState ACTIVE_HEALTHY -ReadSecret $f.reader -SaveSecret $f.writer -Request $f.request *>&1)
 $r=$captured[-1];Check ($r.ready -and $r.publicSource -eq 'publishable' -and $r.serverSource -eq 'secret') 'Modern pair rejected'
 Check (($captured|Out-String) -notmatch 'SENTINEL|sb_publishable_|sb_secret_|postgresql://') 'Modern secret leaked'
 Check ($f.ctx.writes['staging-vercel-env.dpapi'].Contains('NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_SENTINEL_PUBLIC')) 'Wrong public mapping'
 Check ($f.ctx.writes['staging-vercel-env.dpapi'].Contains('SUPABASE_SERVICE_ROLE_KEY=sb_secret_SENTINEL_SECRET')) 'Wrong server mapping'
}
Test 'complete modern fallback accepts incomplete legacy' { $f=Fixture @{missingService=$true};$r=Invoke-Fixture $f;Check ($r.ready -and $r.publicSource -eq 'publishable') 'Fallback rejected' }
Test 'modern type prefix mismatch refused' { $f=Fixture @{modernOnly=$true;badPrefix=$true};Expect-Failure $f 'MODERN_KEY_INVALID';Check ($f.ctx.writes.Count -eq 0) 'Invalid credentials stored' }
Test 'empty active key result fails before pooler or storage' {
 $f=Fixture @{active=$true;emptyKeys=$true};$r=Invoke-StagingCredentialDiscovery -ExpectedState ACTIVE_HEALTHY -ReadSecret $f.reader -SaveSecret $f.writer -Request $f.request
 Check (-not $r.ready -and $f.ctx.requests.Count -eq 2 -and $f.ctx.writes.Count -eq 0) 'Empty active gate passed'
}
Test 'active gate refuses paused staging before key read' {
 $f=Fixture;$r=Invoke-StagingCredentialDiscovery -ExpectedState ACTIVE_HEALTHY -ReadSecret $f.reader -SaveSecret $f.writer -Request $f.request
 Check ($r.code -eq 'STAGING_NOT_ACTIVE' -and $f.ctx.requests.Count -eq 1) 'Paused project passed active gate'
}
Test 'transaction primary connection selects session port on provider host' { $f=Fixture @{transactionOnly=$true};$r=Invoke-Fixture $f;Check ($r.ready -and $r.sourcePort -eq 6543 -and $r.port -eq 5432 -and $r.host -eq 'aws-9-ca-central-1.pooler.supabase.com') 'Session derivation failed' }
Test 'ambiguous modern candidates rejected without choosing first' { $f=Fixture @{modernOnly=$true;duplicateModern=$true};$r=Invoke-Fixture $f;Check (-not $r.ready -and $f.ctx.writes.Count -eq 0) 'Ambiguous selection accepted' }
Test 'modern newline cannot inject environment entries' { $f=Fixture @{modernOnly=$true;newlineKey=$true};Expect-Failure $f 'MODERN_KEY_INVALID' }
Test 'active empty pooler fails without partial credential writes' {
 $f=Fixture @{active=$true;missingPooler=$true};$r=Invoke-StagingCredentialDiscovery -ExpectedState ACTIVE_HEALTHY -ReadSecret $f.reader -SaveSecret $f.writer -Request $f.request
 Check (-not $r.ready -and $f.ctx.writes.Count -eq 0) 'Empty active pooler accepted'
}
foreach($kind in @('API_KEYS','POOLER')) {
 foreach($status in @(403,404,500)) {
  Test ($kind+' HTTP '+$status+' is distinct from empty') {
   $f=Fixture;$original=$f.request;$match=if($kind -eq 'API_KEYS'){'api-keys'}else{'/pooler$'}
   $f.request={param($path,$token) if($path -match $match){return [pscustomobject]@{status=$status;jsonValid=$false;body='SENTINEL_SECRET_BODY'}};& $original $path $token}.GetNewClosure()
   Expect-Failure $f ($kind+'_HTTP_FAILED');$r=Invoke-Fixture $f
   Check ($r.httpStatus.$kind -eq $status) 'HTTP status lost'
  }
 }
 Test ($kind+' malformed JSON response') {
  $f=Fixture;$original=$f.request;$match=if($kind -eq 'API_KEYS'){'api-keys'}else{'/pooler$'}
  $f.request={param($path,$token) if($path -match $match){return [pscustomobject]@{status=200;jsonValid=$false;body=$null}};& $original $path $token}.GetNewClosure()
  Expect-Failure $f ($kind+'_MALFORMED')
 }
 Test ($kind+' object instead of array rejected') {
  $f=Fixture;$original=$f.request;$match=if($kind -eq 'API_KEYS'){'api-keys'}else{'/pooler$'}
  $f.request={param($path,$token) if($path -match $match){return [pscustomobject]@{status=200;jsonValid=$true;body=[pscustomobject]@{secret='SENTINEL_SECRET'}}};& $original $path $token}.GetNewClosure()
  Expect-Failure $f ($kind+'_MALFORMED')
 }
}
Test 'empty keys exact code' {Expect-Failure (Fixture @{emptyKeys=$true}) 'API_KEYS_EMPTY'}
Test 'empty pooler exact code' {Expect-Failure (Fixture @{missingPooler=$true}) 'POOLER_CONFIG_EMPTY'}
Test 'incomplete legacy exact code' {Expect-Failure (Fixture @{legacyOnly=$true;missingService=$true}) 'LEGACY_PAIR_INCOMPLETE'}
Test 'incomplete modern exact code' {Expect-Failure (Fixture @{modernOnly=$true;missingModernSecret=$true}) 'MODERN_PAIR_INCOMPLETE'}
Test 'mixed incomplete generations exact code' {Expect-Failure (Fixture @{missingService=$true;missingModernSecret=$true}) 'NO_USABLE_KEY_PAIR'}
Test 'ambiguous modern exact code' {Expect-Failure (Fixture @{modernOnly=$true;duplicateModern=$true}) 'KEY_PAIR_AMBIGUOUS'}
Test 'DPAPI load failure distinct from missing PAT' {$f=Fixture;$f.reader={param($name)throw 'DPAPI_READ_FAILED'};Expect-Failure $f 'DPAPI_READ_FAILED'}
Test 'missing DB password exact stage and code' {
 $f=Fixture;$original=$f.reader;$f.reader={param($name)if($name -eq 'staging-db-password.dpapi'){throw 'SENTINEL_SECRET'};& $original $name}.GetNewClosure()
 Expect-Failure $f 'DB_PASSWORD_UNAVAILABLE';$r=Invoke-Fixture $f;Check ($r.stage -eq 'db_password_load' -and $r.lastCompleted -eq 'session_pooler_selected') 'Lost progression'
}
Test 'DB URI store failure distinct from other secure saves' {
 $f=Fixture;$original=$f.writer;$f.writer={param($name,$value)if($name -eq 'staging-db-url.dpapi'){throw ('SENTINEL_SECRET '+$value)};& $original $name $value}.GetNewClosure()
 Expect-Failure $f 'DB_URI_SECURE_STORE_FAILED'
}
Test 'checkpoint contains only safe fields on validation failure' {
 $f=Fixture @{wrongHost=$true};$trace=[Collections.Generic.List[string]]::new()
 $checkpoint={param($snapshot)$trace.Add(($snapshot|ConvertTo-Json -Depth 8 -Compress))}.GetNewClosure()
 $r=Invoke-StagingCredentialDiscovery -ReadSecret $f.reader -SaveSecret $f.writer -Request $f.request -Checkpoint $checkpoint
 Check ($r.code -eq 'POOLER_HOST_INVALID' -and $r.selection -eq 'legacy' -and $r.httpStatus.POOLER -eq 200) 'Lost useful error detail'
 Check (($trace -join '') -notmatch 'SENTINEL|sb_secret_|sb_publishable_|postgresql://|connection_string') 'Secret in checkpoints'
 Check ($trace.Count -gt 5 -and $r.completed -contains 'key_pair_selected') 'Missing progress checkpoints'
}
Test 'checkpoint storage failure fails closed before any secret read' {
 $f=Fixture;$r=Invoke-StagingCredentialDiscovery -ReadSecret $f.reader -SaveSecret $f.writer -Request $f.request -Checkpoint {throw 'SENTINEL_SECRET'}
 Check ($r.code -eq 'CHECKPOINT_WRITE_FAILED' -and -not $r.ready -and $f.ctx.reads.Count -eq 0) 'Checkpoint failure ignored'
}
Test 'pooler record missing connection has exact failure' {
 $f=Fixture;$original=$f.request;$f.request={param($path,$token)$r=& $original $path $token;if($path -match '/pooler$'){$r.body=@([pscustomobject]@{database_type='PRIMARY'})};$r}.GetNewClosure()
 Expect-Failure $f 'POOLER_CONNECTION_MISSING'
}
Test 'key record missing field has exact malformed failure' {
 $f=Fixture;$original=$f.request;$f.request={param($path,$token)$r=& $original $path $token;if($path -match 'api-keys'){$r.body=@([pscustomobject]@{type='legacy'})};$r}.GetNewClosure()
 Expect-Failure $f 'API_KEYS_MALFORMED'
}
Test 'JSON transport preserves empty array and one-item array shape' {
 $empty=ConvertFrom-Json -InputObject '[]' -NoEnumerate
 $single=ConvertFrom-Json -InputObject '[{"type":"legacy"}]' -NoEnumerate
 Check ($empty -is [array] -and $empty.Count -eq 0 -and $single -is [array] -and $single.Count -eq 1) 'JSON array shape lost'
}
Test 'metadata malformed has exact code' {
 $f=Fixture;$f.request={param($path,$token)[pscustomobject]@{status=200;jsonValid=$true;body=[pscustomobject]@{id='mgnkvfohpqixgacszovv'}}}
 Expect-Failure $f 'METADATA_MALFORMED'
}
Test 'ambiguous session metadata has exact code' {
 $f=Fixture;$original=$f.request;$f.request={param($path,$token)$r=& $original $path $token;if($path -match '/pooler$'){$r.body=@($r.body[0],$r.body[0])};$r}.GetNewClosure()
 Expect-Failure $f 'POOLER_AMBIGUOUS'
}
Test 'invalid existing rate secret refused' {
 $f=Fixture;$original=$f.reader;$f.reader={param($name)if($name -eq 'rate-secret.dpapi'){return 'short'};& $original $name}.GetNewClosure()
 Expect-Failure $f 'RATE_SECRET_INVALID'
}
Test 'environment save failure does not report ready after URI saved' {
 $f=Fixture;$original=$f.writer;$f.writer={param($name,$value)if($name -eq 'staging-vercel-env.dpapi'){throw 'SENTINEL_SECRET'};& $original $name $value}.GetNewClosure()
 Expect-Failure $f 'SECURE_STORE_FAILED';$r=Invoke-Fixture $f
 Check ($r.stage -eq 'environment_store' -and $r.completed -contains 'db_uri_stored') 'Partial secure progress not captured'
}
$existingPassed=$passed
# Every contract case exercises the complete discovery gate with synthetic API
# envelopes and an in-memory writer. No hosted credentials or requests are used.
function Pooler-Fixture([scriptblock]$Transform) {
 $f=Fixture @{transactionOnly=$true};$original=$f.request
 $f.request={param($path,$token)
  $r=& $original $path $token
  if($path.EndsWith('/pooler')){$r.body=@(& $Transform $r.body[0])}
  return $r
 }.GetNewClosure()
 return $f
}
function Connection-Fixture([string]$Connection) {
 $transform={param($row)$row.connection_string=$Connection;$row.connectionString=$Connection;$row}.GetNewClosure()
 return Pooler-Fixture $transform
}
foreach($case in @(
 @{name='wrong project';uri='postgresql://postgres.gdsmyxzqtmhwbcyobzou@aws-9-ca-central-1.pooler.supabase.com:6543/postgres';code='POOLER_PROJECT_MISMATCH'},
 @{name='wrong role';uri='postgresql://reader.mgnkvfohpqixgacszovv@aws-9-ca-central-1.pooler.supabase.com:6543/postgres';code='POOLER_USER_MISMATCH'},
 @{name='unqualified role';uri='postgresql://postgres@aws-9-ca-central-1.pooler.supabase.com:6543/postgres';code='POOLER_USER_MISMATCH'},
 @{name='wrong database';uri='postgresql://postgres.mgnkvfohpqixgacszovv@aws-9-ca-central-1.pooler.supabase.com:6543/template1';code='POOLER_DATABASE_MISMATCH'},
 @{name='direct database host';uri='postgresql://postgres.mgnkvfohpqixgacszovv@db.mgnkvfohpqixgacszovv.supabase.co:5432/postgres';code='POOLER_HOST_INVALID'},
 @{name='host suffix spoof';uri='postgresql://postgres.mgnkvfohpqixgacszovv@aws-9-ca-central-1.pooler.supabase.com.evil.example:6543/postgres';code='POOLER_HOST_INVALID'},
 @{name='missing host';uri='postgresql://postgres.mgnkvfohpqixgacszovv@:6543/postgres';code='POOLER_HOST_MISSING'},
 @{name='unsupported port';uri='postgresql://postgres.mgnkvfohpqixgacszovv@aws-9-ca-central-1.pooler.supabase.com:9999/postgres';code='POOLER_PORT_INVALID'},
 @{name='missing port';uri='postgresql://postgres.mgnkvfohpqixgacszovv@aws-9-ca-central-1.pooler.supabase.com/postgres';code='POOLER_PORT_INVALID'},
 @{name='malformed URL';uri='SENTINEL_SECRET_BAD_URI';code='POOLER_CONNECTION_MALFORMED'},
 @{name='wrong scheme';uri='https://postgres.mgnkvfohpqixgacszovv@aws-9-ca-central-1.pooler.supabase.com:6543/postgres';code='POOLER_CONNECTION_MALFORMED'},
 @{name='URI fragment';uri='postgresql://postgres.mgnkvfohpqixgacszovv@aws-9-ca-central-1.pooler.supabase.com:6543/postgres#SENTINEL';code='POOLER_CONNECTION_MALFORMED'},
 @{name='invalid percent escape';uri='postgresql://postgres.%zz@aws-9-ca-central-1.pooler.supabase.com:6543/postgres';code='POOLER_CONNECTION_MALFORMED'},
 @{name='newline';uri="postgresql://postgres.mgnkvfohpqixgacszovv@aws-9-ca-central-1.pooler.supabase.com:6543/postgres`n";code='POOLER_CONNECTION_MALFORMED'},
 @{name='missing connection';uri='';code='POOLER_CONNECTION_MISSING'}
)) {
 Test ('pooler contract rejects '+$case.name) {
  $f=Connection-Fixture $case.uri;Expect-Failure $f $case.code
  Check ($f.ctx.writes.Count -eq 0 -and -not $f.ctx.reads.Contains('staging-db-password.dpapi')) 'Failure read DB password or stored credentials'
 }
}
Test 'pooler contract accepts source 5432 even with transaction label and backend fields' {
 $f=Pooler-Fixture {param($row)$row.connection_string=$row.connection_string.Replace(':6543/',':5432/');$row.connectionString=$row.connection_string;$row.db_host='db.mgnkvfohpqixgacszovv.supabase.co';$row.db_user='postgres';$row.db_port=1111;$row.db_name='ignored';$row}
 $r=Invoke-Fixture $f;Check ($r.ready -and $r.sourcePort -eq 5432 -and $r.host -eq 'aws-9-ca-central-1.pooler.supabase.com') 'Used upstream fields or label'
}
Test 'pooler contract does not need a session label or backend fields' {
 $f=Pooler-Fixture {param($row)[pscustomobject]@{database_type='PRIMARY';connection_string=$row.connection_string}}
 $r=Invoke-Fixture $f;Check ($r.ready -and $r.sourcePort -eq 6543 -and $r.port -eq 5432) 'Required redundant fields'
}
Test 'pooler contract accepts postgres scheme' {
 $f=Connection-Fixture 'postgres://postgres.mgnkvfohpqixgacszovv@aws-9-ca-central-1.pooler.supabase.com:6543/postgres'
 Check (Invoke-Fixture $f).ready 'Postgres scheme rejected'
}
Test 'pooler contract refuses alias-only config rather than guessing' {
 $f=Pooler-Fixture {param($row)$row.PSObject.Properties.Remove('connection_string');$row}
 Expect-Failure $f 'POOLER_CONNECTION_MISSING'
}
Test 'pooler contract rejects conflicting connection aliases' {
 $f=Pooler-Fixture {param($row)$row.connectionString='SENTINEL_SECRET_OTHER';$row}
 Expect-Failure $f 'POOLER_CONNECTION_AMBIGUOUS'
}
Test 'pooler contract rejects non-string connection' {
 $f=Pooler-Fixture {param($row)$row.connection_string=@{secret='SENTINEL'};$row}
 Expect-Failure $f 'POOLER_CONNECTION_MALFORMED'
}
Test 'pooler contract rejects empty config array' {
 $f=Pooler-Fixture {param($row)};Expect-Failure $f 'POOLER_CONFIG_EMPTY'
}
Test 'pooler contract rejects no primary config' {
 $f=Pooler-Fixture {param($row)$row.database_type='READ_REPLICA';$row};Expect-Failure $f 'POOLER_PRIMARY_NOT_FOUND'
}
Test 'pooler contract rejects multiple primaries without choosing first' {
 $f=Pooler-Fixture {param($row)$row;$row};Expect-Failure $f 'POOLER_AMBIGUOUS'
 Check ($f.ctx.writes.Count -eq 0) 'Ambiguous config stored'
}
Test 'pooler contract selects sole primary regardless of replica order' {
 foreach($replicaFirst in @($true,$false)){
  $transform={param($row)$replica=[pscustomobject]@{database_type='READ_REPLICA';connection_string='SENTINEL_REPLICA'};if($replicaFirst){$replica;$row}else{$row;$replica}}.GetNewClosure()
  $f=Pooler-Fixture $transform;Check (Invoke-Fixture $f).ready 'Replica ordering changed selection'
 }
}
Test 'pooler contract discards returned password and query overrides without logging' {
 $f=Connection-Fixture 'postgresql://postgres.mgnkvfohpqixgacszovv:SENTINEL_PROVIDER%3A%2F%40@aws-9-ca-central-1.pooler.supabase.com:6543/postgres?host=evil.example&password=SENTINEL_QUERY&sslmode=disable'
 $trace=[Collections.Generic.List[string]]::new();$checkpoint={param($snapshot)$trace.Add(($snapshot|ConvertTo-Json -Depth 8 -Compress))}.GetNewClosure()
 $output=@(Invoke-StagingCredentialDiscovery -ReadSecret $f.reader -SaveSecret $f.writer -Request $f.request -Checkpoint $checkpoint *>&1)
 Check $output[-1].ready 'Secret-bearing source rejected'
 $serialized=($output|ConvertTo-Json -Depth 8)+($trace -join '')
 Check ($serialized -notmatch 'SENTINEL|postgresql://|connection_string|evil.example') 'Provider secret in output/checkpoint'
 $stored=$f.ctx.writes['staging-db-url.dpapi'];$uri=[Uri]$stored
 Check ($uri.UserInfo.EndsWith('SENTINEL_PASSWORD%3A%2F%3F%23') -and $uri.Query -eq '?sslmode=verify-full' -and $uri.Port -eq 5432) 'Preserved password/TLS not used'
 Check (($f.ctx.writes.Values -join '') -notmatch 'SENTINEL_PROVIDER|SENTINEL_QUERY|evil.example') 'Provider credential/query persisted'
}
Test 'pooler contract malformed secret-bearing URI never enters checkpoints' {
 $f=Connection-Fixture 'postgresql://postgres.mgnkvfohpqixgacszovv:SENTINEL_PROVIDER@evil.example:6543/postgres'
 $trace=[Collections.Generic.List[string]]::new();$checkpoint={param($snapshot)$trace.Add(($snapshot|ConvertTo-Json -Depth 8 -Compress))}.GetNewClosure()
 $output=@(Invoke-StagingCredentialDiscovery -ReadSecret $f.reader -SaveSecret $f.writer -Request $f.request -Checkpoint $checkpoint *>&1)
 Check ($output[-1].code -eq 'POOLER_HOST_INVALID' -and $f.ctx.writes.Count -eq 0) 'Unsafe source accepted'
 Check ((($output|ConvertTo-Json -Depth 8)+($trace -join '')) -notmatch 'SENTINEL|postgresql://|evil.example') 'Failure leaked source'
}
foreach($synthetic in @('test@value','test:value','test/value','test?value','test#value','test%value','test&value','test value','all@:/?#%& together')) {
 Test 'synthetic password reserved-character round trip through real builder' {
  $f=Fixture;$original=$f.reader
  $f.reader={param($name)if($name -eq 'staging-db-password.dpapi'){return $synthetic};& $original $name}.GetNewClosure()
  $result=Invoke-Fixture $f
  Check $result.ready 'Synthetic builder failed'
  $uri=[Uri]$f.ctx.writes['staging-db-url.dpapi']
  $encoded=$uri.UserInfo.Substring($uri.UserInfo.IndexOf(':')+1)
  Check ($encoded -ceq [Uri]::EscapeDataString($synthetic)) 'Encoding mismatch'
  Check ([Uri]::UnescapeDataString($encoded) -ceq $synthetic) 'Round trip mismatch'
  Check ($uri.Query -eq '?sslmode=verify-full' -and $uri.Fragment -eq '') 'Password changed connection structure'
 }
}
Write-Output ('PASS: '+$passed+' credential-discovery tests; no live requests')
