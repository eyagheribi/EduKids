[CmdletBinding()]
param(
    [switch]$Stop
)

$ErrorActionPreference = 'Stop'
$workspace = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$runtime = Join-Path $env:TEMP 'EduKids-local-dev'
$statePath = Join-Path $runtime 'processes.json'

if ($Stop) {
    if (-not (Test-Path -LiteralPath $statePath)) {
        Write-Output 'Aucun processus EduKids local enregistré.'
        exit 0
    }
    $state = Get-Content -LiteralPath $statePath -Raw | ConvertFrom-Json
    foreach ($entry in $state.processes) {
        $process = Get-Process -Id ([int]$entry.pid) -ErrorAction SilentlyContinue
        if ($process) {
            Stop-Process -Id $process.Id -ErrorAction SilentlyContinue
            Write-Output "Arrêt demandé : $($entry.name) (PID $($entry.pid))."
        }
    }
    Remove-Item -LiteralPath $statePath -Force
    exit 0
}

New-Item -ItemType Directory -Path $runtime -Force | Out-Null
$configPath = Join-Path $workspace 'src/Comptes.Api/appsettings.json'
$config = Get-Content -LiteralPath $configPath -Raw | ConvertFrom-Json
$jwtKey = $env:Jwt__Key
if ([string]::IsNullOrWhiteSpace($jwtKey)) { $jwtKey = $config.Jwt.Key }
if ([string]::IsNullOrWhiteSpace($jwtKey) -or [Text.Encoding]::UTF8.GetByteCount($jwtKey) -lt 32) {
    throw 'Configurez Jwt__Key (au moins 32 octets) avant de démarrer les API.'
}

$services = @(
    @{ name = 'Comptes.Api'; directory = 'src/Comptes.Api'; dll = 'bin/Debug/net9.0/Comptes.Api.dll'; port = 15220; connection = 'ConnectionStrings__Comptes'; db = 'comptes.db' },
    @{ name = 'Espaces.Api'; directory = 'src/Espaces.Api'; dll = 'bin/Debug/net9.0/Espaces.Api.dll'; port = 15092; connection = 'ConnectionStrings__Espaces'; db = 'espaces.db' },
    @{ name = 'Activites.Api'; directory = 'src/Activites.Api'; dll = 'bin/Debug/net8.0/Activites.Api.dll'; port = 15156; connection = 'ConnectionStrings__Activities'; db = 'activites.db' },
    @{ name = 'Suivi.Api'; directory = 'src/Suivi.Api'; dll = 'bin/Debug/net8.0/Suivi.Api.dll'; port = 15102; connection = 'ConnectionStrings__Suivi'; db = 'suivi.db' }
)

$started = @()
foreach ($service in $services) {
    $port = [int]$service.port
    $listener = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($listener) { throw "Le port $port est déjà utilisé; $($service.name) n’a pas été démarré." }
}

$previous = @{}
foreach ($name in @('Jwt__Key', 'ASPNETCORE_ENVIRONMENT', 'RabbitMq__Password', 'ServiceEndpoints__EspacesApi')) {
    $previous[$name] = [Environment]::GetEnvironmentVariable($name, 'Process')
}
try {
    $env:Jwt__Key = $jwtKey
    $env:ASPNETCORE_ENVIRONMENT = 'Development'
    $env:RabbitMq__Password = 'local-demo-no-broker'
    $env:ServiceEndpoints__EspacesApi = 'http://localhost:15092'
    foreach ($service in $services) {
        $serviceDir = Join-Path $workspace $service.directory
        $dbPath = Join-Path $runtime $service.db
        [Environment]::SetEnvironmentVariable($service.connection, "Data Source=$dbPath", 'Process')
        $env:ASPNETCORE_URLS = "http://localhost:$($service.port)"
        $logOut = Join-Path $runtime "$($service.name).out.log"
        $logErr = Join-Path $runtime "$($service.name).err.log"
        $proc = Start-Process -FilePath 'dotnet' -ArgumentList @($service.dll) -WorkingDirectory $serviceDir -WindowStyle Hidden -PassThru -RedirectStandardOutput $logOut -RedirectStandardError $logErr
        $started += @{ name = $service.name; pid = $proc.Id }
        Write-Output "Démarrage $($service.name) sur http://localhost:$($service.port) (PID $($proc.Id)); base isolée dans $runtime."
    }
} finally {
    foreach ($name in $previous.Keys) { [Environment]::SetEnvironmentVariable($name, $previous[$name], 'Process') }
    Remove-Item Env:ASPNETCORE_URLS -ErrorAction SilentlyContinue
    foreach ($service in $services) { Remove-Item "Env:$($service.connection)" -ErrorAction SilentlyContinue }
}

Set-Content -LiteralPath $statePath -Value (@{ processes = $started } | ConvertTo-Json -Depth 4)
Write-Output 'Les API utilisent les ports isolés 15220, 15092, 15156 et 15102 pour éviter les services déjà présents sur les ports standards.'
Write-Output 'Arrêt : powershell -ExecutionPolicy Bypass -File scripts/start-local.ps1 -Stop'
Write-Output 'Les bases et journaux sont conservés dans le dossier temporaire EduKids-local-dev.'
