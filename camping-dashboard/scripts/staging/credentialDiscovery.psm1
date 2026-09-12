Set-StrictMode -Version Latest

function Get-StagingTokenFile([string]$Operation) {
  if ($Operation -in @('discover','export','pooler')) { return 'read-setup-token.dpapi' }
  if ($Operation -in @('preflight','create','auth','plan','apply','verify')) { return 'management-token.dpapi' }
  throw 'DISCOVERY_UNKNOWN_OPERATION'
}

function Assert-StagingDiscoveryRef([string]$Ref) {
  if ($Ref -in @('gdsmyxzqtmhwbcyobzou','rmfhueseulevyvetblnn')) { throw 'PROTECTED_PROJECT_TARGETED' }
  if ($Ref -cne 'mgnkvfohpqixgacszovv') { throw 'STAGING_IDENTITY_MISMATCH' }
}

function Read-StagingEncrypted([string]$Directory,[string]$Name) {
  if (-not [IO.File]::Exists((Join-Path $Directory $Name))) { throw 'CREDENTIAL_UNAVAILABLE' }
  try {
    $secure = [IO.File]::ReadAllText((Join-Path $Directory $Name)) | ConvertTo-SecureString -ErrorAction Stop
    try { return [Management.Automation.PSCredential]::new('staging',$secure).GetNetworkCredential().Password }
    finally { $secure.Dispose() }
  } catch { throw 'DPAPI_READ_FAILED' }
}

function Write-StagingEncrypted([string]$Directory,[string]$Name,[string]$Value) {
  $temporary = $null
  try {
    if ($Name -notmatch '^[a-z-]+\.dpapi$') { throw 'Invalid storage name' }
    $destination = Join-Path $Directory $Name
    $temporary = $destination + '.' + [Guid]::NewGuid().ToString('N') + '.tmp'
    $secure = ConvertTo-SecureString $Value -AsPlainText -Force -ErrorAction Stop
    try { $ciphertext = ConvertFrom-SecureString $secure -ErrorAction Stop }
    finally { $secure.Dispose() }
    # Only ciphertext is ever written, including the atomic replacement file.
    [IO.File]::WriteAllText($temporary,$ciphertext)
    $check = Read-StagingEncrypted $Directory ([IO.Path]::GetFileName($temporary))
    if ($check -cne $Value) { throw 'Encrypted round-trip mismatch' }
    [IO.File]::Move($temporary,$destination,$true)
  } catch { throw 'DISCOVERY_ENCRYPTED_STORAGE_FAILED' }
  finally {
    if ($temporary -and [IO.File]::Exists($temporary)) { [IO.File]::Delete($temporary) }
    $ciphertext=$null; $check=$null
  }
}

function Resolve-StagingSessionPooler([array]$Rows,[string]$Ref) {
  Assert-StagingDiscoveryRef $Ref
  if ($Rows.Count -eq 0) { throw 'POOLER_CONFIG_EMPTY' }
  foreach ($row in $Rows) {
    if ($null -eq $row -or -not $row.PSObject.Properties['database_type']) { throw 'POOLER_METADATA_INVALID' }
  }
  # The API returns Supavisor configs, not one record per listener mode.
  # Match CLI 2.109.1's primary connection_string source; never use db_host.
  $primary=@($Rows | Where-Object { $_.database_type -ceq 'PRIMARY' })
  if ($primary.Count -eq 0) { throw 'POOLER_PRIMARY_NOT_FOUND' }
  if ($primary.Count -ne 1) { throw 'POOLER_AMBIGUOUS' }
  $config=$primary[0]
  $raw=$null; $parsed=$null
  try {
    if (-not $config.PSObject.Properties['connection_string'] -or
        $null -eq $config.connection_string -or $config.connection_string -ceq '') { throw 'POOLER_CONNECTION_MISSING' }
    $raw=$config.connection_string
    if ($raw -isnot [string] -or $raw -match '[\s\\]' -or $raw -match '%(?![0-9A-Fa-f]{2})') { throw 'POOLER_CONNECTION_MALFORMED' }
    # Do not fall back to the deprecated camelCase alias. Reject disagreement.
    if ($config.PSObject.Properties['connectionString'] -and $null -ne $config.connectionString -and
        $config.connectionString -cne $raw) { throw 'POOLER_CONNECTION_AMBIGUOUS' }
    # Strip any provider password (including its placeholder) before parsing.
    # The separately preserved password is the only credential used for storage.
    $parts=[regex]::Match($raw,'\A(postgres(?:ql)?://)([^/@?#]+)@([^/?#]*)(/[^?#]*)(?:\?[^#]*)?\z')
    if (-not $parts.Success) { throw 'POOLER_CONNECTION_MALFORMED' }
    $rawUser=$parts.Groups[2].Value.Split(':',2)[0]
    if (-not $parts.Groups[3].Value -or $parts.Groups[3].Value -match '^:') { throw 'POOLER_HOST_MISSING' }
    try { $parsed=[Uri]::new($parts.Groups[1].Value+$rawUser+'@'+$parts.Groups[3].Value+$parts.Groups[4].Value,[UriKind]::Absolute) }
    catch { throw 'POOLER_CONNECTION_MALFORMED' }
    $user=[Uri]::UnescapeDataString($parsed.UserInfo)
    if ($user -cnotmatch '^postgres\.') { throw 'POOLER_USER_MISMATCH' }
    if ($user -cne ('postgres.'+$Ref)) { throw 'POOLER_PROJECT_MISMATCH' }
    if ($parts.Groups[4].Value -cne '/postgres') { throw 'POOLER_DATABASE_MISMATCH' }
    if (-not $parsed.Host) { throw 'POOLER_HOST_MISSING' }
    if ($parsed.Host -cnotmatch '^aws-[0-9]+-[a-z0-9-]+\.pooler\.supabase\.com\z') { throw 'POOLER_HOST_INVALID' }
    if ($parsed.Port -notin @(5432,6543)) { throw 'POOLER_PORT_INVALID' }
    return [pscustomobject]@{host=$parsed.Host;user=$user;database='postgres';sourcePort=$parsed.Port;port=5432;mode='session'}
  } finally { $raw=$null; $parsed=$null; $parts=$null; $config=$null }
}

function Invoke-StagingCredentialDiscoveryCore {
  param(
    [string]$Ref = 'mgnkvfohpqixgacszovv',
    [ValidateSet('INACTIVE','ACTIVE_HEALTHY')][string]$ExpectedState = 'INACTIVE',
    [hashtable]$Diagnostic,
    [Parameter(Mandatory)][scriptblock]$ReadSecret,
    [Parameter(Mandatory)][scriptblock]$SaveSecret,
    [Parameter(Mandatory)][scriptblock]$Request
  )
  function Step([string]$Name,[bool]$Complete=$false) {
    $Diagnostic.stage=$Name
    if ($Complete) { $Diagnostic.lastCompleted=$Name; $Diagnostic.completed.Add($Name) }
    if ($Diagnostic.checkpoint) {
      try { $null=& $Diagnostic.checkpoint (Get-StagingDiagnosticSnapshot $Diagnostic) } catch { throw 'CHECKPOINT_WRITE_FAILED' }
    }
  }
  Step 'target_validation'
  Assert-StagingDiscoveryRef $Ref
  Step 'target_verified' $true
  Step 'read_pat_load'
  try { $token = & $ReadSecret (Get-StagingTokenFile 'discover') } catch {
    if ($_.Exception.Message -ceq 'DPAPI_READ_FAILED') { throw 'DPAPI_READ_FAILED' }
    throw 'READ_PAT_UNAVAILABLE'
  }
  if ([string]::IsNullOrWhiteSpace($token)) { throw 'READ_PAT_UNAVAILABLE' }
  Step 'read_pat_loaded' $true
  function Read-Api([string]$Path,[string]$Kind) {
    Step ($Kind.ToLower()+'_request')
    try { $response=& $Request $Path $token } catch { throw ($Kind+'_HTTP_FAILED') }
    if ($null -eq $response -or -not $response.PSObject.Properties['status'] -or $response.status -isnot [int] -or $response.status -lt 100 -or $response.status -gt 599) { throw ($Kind+'_MALFORMED') }
    $Diagnostic.http[$Kind]=[int]$response.status
    if ($response.status -ne 200) { throw ($Kind+'_HTTP_FAILED') }
    Step ($Kind.ToLower()+'_http_200') $true
    if (-not $response.PSObject.Properties['jsonValid'] -or -not $response.jsonValid -or -not $response.PSObject.Properties['body']) { throw ($Kind+'_MALFORMED') }
    if ($Kind -ne 'METADATA' -and $response.body -isnot [array]) { throw ($Kind+'_MALFORMED') }
    return ,$response.body
  }
  function Assert-DiscoveryIdentity {
    Assert-StagingDiscoveryRef $Ref
    $p = Read-Api ('/projects/'+$Ref) 'METADATA'
    Step 'identity_validation'
    foreach($field in @('id','name','organization_id','database','status')){if($null -eq $p -or -not $p.PSObject.Properties[$field]){throw 'METADATA_MALFORMED'}}
    if($null -eq $p.database -or -not $p.database.host){throw 'METADATA_MALFORMED'}
    if ($p.id -cne $Ref -or $p.name -cne 'field-protocol-staging' -or $p.organization_id -cne 'qvhhhjlpntbtctqinayz' -or
        $p.database.host -cne ('db.'+$Ref+'.supabase.co')) { throw 'STAGING_IDENTITY_MISMATCH' }
    Step 'project_identity_verified' $true
    if ($p.status -cne $ExpectedState) { if($ExpectedState -eq 'ACTIVE_HEALTHY'){throw 'STAGING_NOT_ACTIVE'};throw 'STAGING_NOT_PAUSED' }
    Step 'expected_state_verified' $true
  }
  try {
    Assert-DiscoveryIdentity
    $keys = Read-Api ('/projects/'+$Ref+'/api-keys?reveal=true') 'API_KEYS'
    Step 'key_selection'
    if ($keys.Count -eq 0) { throw 'API_KEYS_EMPTY' }
    foreach($key in $keys) { if($null -eq $key -or -not $key.PSObject.Properties['type'] -or -not $key.PSObject.Properties['name'] -or -not $key.PSObject.Properties['api_key'] -or $key.api_key -isnot [string]){throw 'API_KEYS_MALFORMED'} }
    $anonRows = @($keys | Where-Object { $_.type -ceq 'legacy' -and $_.name -ceq 'anon' })
    $serviceRows = @($keys | Where-Object { $_.type -ceq 'legacy' -and $_.name -ceq 'service_role' })
    $publicRows = @($keys | Where-Object type -CEQ 'publishable')
    $secretRows = @($keys | Where-Object type -CEQ 'secret')
    $availability = [ordered]@{
      apiKeyStatus=200; legacyAnon=($anonRows.Count -eq 1 -and !!$anonRows[0].api_key)
      legacyServiceRole=($serviceRows.Count -eq 1 -and !!$serviceRows[0].api_key)
      modernPublishable=(@($keys | Where-Object type -eq 'publishable').Count -gt 0)
      modernSecret=(@($keys | Where-Object type -eq 'secret').Count -gt 0)
    }
    $hasLegacyPair=$availability.legacyAnon -and $availability.legacyServiceRole
    if ($anonRows.Count -gt 1 -or $serviceRows.Count -gt 1) { throw 'KEY_PAIR_AMBIGUOUS' }
    if ($hasLegacyPair) {
      $anon=$anonRows[0].api_key; $service=$serviceRows[0].api_key
      foreach ($pair in @(@($anon,'anon'),@($service,'service_role'))) {
        try {
          if ($pair[0] -cnotmatch '^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\z') { throw 'Malformed legacy key' }
          $part=$pair[0].Split('.')[1].Replace('-','+').Replace('_','/')
          $part=$part.PadRight([int]([Math]::Ceiling($part.Length/4)*4),'=')
          $claims=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($part)) | ConvertFrom-Json
          if ($claims.ref -cne $Ref -or $claims.role -cne $pair[1]) { throw 'Mismatch' }
        } catch { throw 'LEGACY_KEY_INVALID' }
      }
      $credential = @{publicValue=$anon;serverValue=$service;publicSource='legacy anon';serverSource='legacy service_role'}
    } elseif ($publicRows.Count -eq 1 -and $secretRows.Count -eq 1) {
      # Modern keys are opaque, not JWTs. Trust the guarded provider response
      # type and documented value prefixes, never names or JWT decoding.
      if ($publicRows[0].api_key -cnotmatch '^sb_publishable_[^\s]+\z' -or
          $secretRows[0].api_key -cnotmatch '^sb_secret_[^\s]+\z') { throw 'MODERN_KEY_INVALID' }
      $credential=@{publicValue=$publicRows[0].api_key;serverValue=$secretRows[0].api_key;publicSource='publishable';serverSource='secret'}
    } else {
      if($publicRows.Count -gt 1 -or $secretRows.Count -gt 1){throw 'KEY_PAIR_AMBIGUOUS'}
      if(($anonRows.Count+$serviceRows.Count) -gt 0 -and ($publicRows.Count+$secretRows.Count) -eq 0){throw 'LEGACY_PAIR_INCOMPLETE'}
      if(($publicRows.Count+$secretRows.Count) -gt 0 -and ($anonRows.Count+$serviceRows.Count) -eq 0){throw 'MODERN_PAIR_INCOMPLETE'}
      throw 'NO_USABLE_KEY_PAIR'
    }
    $Diagnostic.selection=if($hasLegacyPair){'legacy'}else{'modern'}
    Step 'key_pair_selected' $true
    Assert-DiscoveryIdentity
    $rows = Read-Api ('/projects/'+$Ref+'/config/database/pooler') 'POOLER'
    Step 'pooler_validation'
    $pooler=Resolve-StagingSessionPooler $rows $Ref
    Step 'session_pooler_selected' $true
    Step 'db_password_load'
    try { $password=& $ReadSecret 'staging-db-password.dpapi' } catch { if($_.Exception.Message -ceq 'DPAPI_READ_FAILED'){throw 'DPAPI_READ_FAILED'};throw 'DB_PASSWORD_UNAVAILABLE' }
    if ([string]::IsNullOrWhiteSpace($password)) { throw 'DB_PASSWORD_UNAVAILABLE' }
    Step 'db_password_loaded' $true
    Step 'db_uri_build'
    try { $dbUri='postgresql://'+$pooler.user+':'+[Uri]::EscapeDataString($password)+'@'+$pooler.host+':5432/postgres?sslmode=verify-full' } catch {throw 'POOLER_SESSION_URI_BUILD_FAILED'}
    Step 'db_uri_built' $true
    $anon=$credential.publicValue; $service=$credential.serverValue
    Step 'environment_assembly'
    try { $rate=& $ReadSecret 'rate-secret.dpapi' } catch { throw 'DPAPI_READ_FAILED' }
    if (-not $rate) { $rate=[Convert]::ToHexString([Security.Cryptography.RandomNumberGenerator]::GetBytes(32)) }
    if ($rate.Length -lt 32) { throw 'RATE_SECRET_INVALID' }
    $environment="NEXT_PUBLIC_SUPABASE_URL=https://$Ref.supabase.co`nNEXT_PUBLIC_SUPABASE_ANON_KEY=$anon`nSUPABASE_SERVICE_ROLE_KEY=$service`nTRIP_INVITATIONS_ORIGIN=https://staging.fieldprotocol.online`nTRIP_INVITATIONS_RATE_SECRET=$rate`nTRIP_INVITATIONS_ENABLED=false`n"
    try {
      Step 'application_credentials_store'
      $null=& $SaveSecret 'staging-anon-key.dpapi' $anon
      $null=& $SaveSecret 'staging-service-role-key.dpapi' $service
      Step 'application_credentials_stored' $true
      Step 'db_uri_store'
      try { $null=& $SaveSecret 'staging-db-url.dpapi' $dbUri } catch {throw 'DB_URI_SECURE_STORE_FAILED'}
      Step 'db_uri_stored' $true
      Step 'environment_store'
      $null=& $SaveSecret 'rate-secret.dpapi' $rate
      $null=& $SaveSecret 'staging-vercel-env.dpapi' $environment
    } catch { if($_.Exception.Message -cin @('DB_URI_SECURE_STORE_FAILED','CHECKPOINT_WRITE_FAILED')){throw};throw 'SECURE_STORE_FAILED' }
    Step 'environment_stored' $true
    return [pscustomobject]@{ready=$true;keys=$availability;publicSource=$credential.publicSource;serverSource=$credential.serverSource;poolerStatus=200;ref=$Ref;host=$pooler.host;user=$pooler.user;database='postgres';port=5432;mode='session';sourcePort=$pooler.sourcePort;encryptedEnvironment='PRESENT';encryptedDbUri='PRESENT';deliveryEnabled=$false}
  } finally { $token=$null;$keys=$null;$rows=$null;$credential=$null;$anon=$null;$service=$null;$password=$null;$dbUri=$null;$environment=$null;$rate=$null }
}
function Get-StagingDiagnosticSnapshot([hashtable]$State) {
  # Never serialize the exception, provider body or credential context.
  return [pscustomobject]@{schemaVersion=1;attemptId=$State.attemptId;timestampUtc=[DateTime]::UtcNow.ToString('o');ready=$State.ready;code=$State.code;stage=$State.stage;lastCompleted=$State.lastCompleted;completed=@($State.completed.ToArray());httpStatus=[pscustomobject]$State.http;selection=$State.selection}
}

function Invoke-StagingCredentialDiscovery {
  param(
    [string]$Ref='mgnkvfohpqixgacszovv',
    [ValidateSet('INACTIVE','ACTIVE_HEALTHY')][string]$ExpectedState='INACTIVE',
    [Parameter(Mandatory)][scriptblock]$ReadSecret,
    [Parameter(Mandatory)][scriptblock]$SaveSecret,
    [Parameter(Mandatory)][scriptblock]$Request,
    [scriptblock]$Checkpoint
  )
  $state=@{attemptId=[Guid]::NewGuid().ToString('N');ready=$false;code='IN_PROGRESS';stage='initialization';lastCompleted=$null;completed=[Collections.Generic.List[string]]::new();http=@{};selection=$null;checkpoint=$Checkpoint}
  $codes=@('PROTECTED_PROJECT_TARGETED','STAGING_IDENTITY_MISMATCH','STAGING_NOT_ACTIVE','STAGING_NOT_PAUSED','READ_PAT_UNAVAILABLE','DPAPI_READ_FAILED','METADATA_HTTP_FAILED','METADATA_MALFORMED','API_KEYS_HTTP_FAILED','API_KEYS_MALFORMED','API_KEYS_EMPTY','LEGACY_PAIR_INCOMPLETE','MODERN_PAIR_INCOMPLETE','KEY_PAIR_AMBIGUOUS','NO_USABLE_KEY_PAIR','LEGACY_KEY_INVALID','MODERN_KEY_INVALID','POOLER_HTTP_FAILED','POOLER_MALFORMED','POOLER_CONFIG_EMPTY','POOLER_PRIMARY_NOT_FOUND','POOLER_AMBIGUOUS','POOLER_CONNECTION_MISSING','POOLER_CONNECTION_MALFORMED','POOLER_CONNECTION_AMBIGUOUS','POOLER_PROJECT_MISMATCH','POOLER_USER_MISMATCH','POOLER_DATABASE_MISMATCH','POOLER_HOST_MISSING','POOLER_HOST_INVALID','POOLER_PORT_INVALID','POOLER_METADATA_INVALID','DB_PASSWORD_UNAVAILABLE','POOLER_SESSION_URI_BUILD_FAILED','DB_URI_SECURE_STORE_FAILED','RATE_SECRET_INVALID','SECURE_STORE_FAILED','CHECKPOINT_WRITE_FAILED')
  try {
    $result=Invoke-StagingCredentialDiscoveryCore -Ref $Ref -ExpectedState $ExpectedState -Diagnostic $state -ReadSecret $ReadSecret -SaveSecret $SaveSecret -Request $Request
    $state.ready=$result.ready; $state.code='OK'
  } catch {
    $state.code=if($_.Exception.Message -cin $codes){$_.Exception.Message}else{'UNEXPECTED_LOCAL_FAILURE'}
  }
  $snapshot=Get-StagingDiagnosticSnapshot $state
  if($Checkpoint){try{$null=& $Checkpoint $snapshot}catch{$state.ready=$false;$state.code='CHECKPOINT_WRITE_FAILED';$snapshot=Get-StagingDiagnosticSnapshot $state}}
  if($state.ready){$result|Add-Member -NotePropertyName diagnostics -NotePropertyValue $snapshot;return $result}
  return $snapshot
}
Export-ModuleMember -Function Get-StagingTokenFile,Assert-StagingDiscoveryRef,Read-StagingEncrypted,Write-StagingEncrypted,Invoke-StagingCredentialDiscovery
