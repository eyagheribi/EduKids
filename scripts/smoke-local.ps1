[CmdletBinding()]
param(
    [string]$BaseAddress = 'http://localhost'
)

$ErrorActionPreference = 'Stop'
function Send-Request {
    param([string]$Method, [string]$Url, [string]$Token, $Body, [int]$ExpectedStatus = 200)
    $headers = @{}
    if ($Token) { $headers.Authorization = "Bearer $Token" }
    $arguments = @{ Uri = $Url; Method = $Method; Headers = $headers; UseBasicParsing = $true; TimeoutSec = 15 }
    if ($null -ne $Body) {
        $arguments.ContentType = 'application/json'
        $arguments.Body = ConvertTo-Json -InputObject $Body -Depth 12 -Compress
    }
    try {
        $response = Invoke-WebRequest @arguments
        $status = [int]$response.StatusCode
        $content = $response.Content
    } catch {
        $status = [int]$_.Exception.Response.StatusCode.value__
        if (-not $status) { throw "$Method $Url failed: $($_.Exception.Message)" }
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $content = $reader.ReadToEnd()
        $reader.Dispose()
    }
    if ($status -ne $ExpectedStatus) { throw "$Method $Url returned $status; expected $ExpectedStatus. $content" }
    if ($content) { return ($content | ConvertFrom-Json) }
    return $null
}

$accounts = "$BaseAddress`:15220"
$spacesApi = "$BaseAddress`:15092"
$gamesApi = "$BaseAddress`:15156"
$progressApi = "$BaseAddress`:15102"
$email = "local-smoke-$([guid]::NewGuid().ToString('N'))@example.test"
$password = 'EduKidsLocal-2026!'

Send-Request POST "$accounts/auth/register" '' @{ Email = $email; MotDePasse = $password; Nom = 'Test'; Prenom = 'Local' } | Out-Null
$login = Send-Request POST "$accounts/auth/login" '' @{ Email = $email; MotDePasse = $password }
$parentToken = $login.token
if (-not $parentToken) { throw 'The parent login response did not include a token.' }

$space = Send-Request POST "$spacesApi/espaces" $parentToken @{ nomEnfant = 'Enfant test'; activites = @('Maths', 'Association', 'Ordonnancement', 'Dictee') }
$otherSpace = Send-Request POST "$spacesApi/espaces" $parentToken @{ nomEnfant = 'Autre espace'; activites = @('Maths') }
$spaceId = [string]$space.id
$game = Send-Request POST "$gamesApi/api/spaces/$spaceId/games" $parentToken @{ type = 'MATH'; title = 'Calcul local'; content = @{ expression = '2 + 3' } } 201

# Role and ownership boundaries must reject a parent trying to start a child's session.
Send-Request POST "$gamesApi/api/spaces/$spaceId/games/$($game.id)/sessions" $parentToken $null 403 | Out-Null
$childLogin = Send-Request POST "$spacesApi/acces/code" '' @{ Code = $space.codeAcces }
$childToken = $childLogin.token
$childGames = Send-Request GET "$gamesApi/api/spaces/$spaceId/games?type=MATH" $childToken $null
if (@($childGames).Count -ne 1) { throw "The child did not see the expected game (count: $(@($childGames).Count))." }
Send-Request GET "$gamesApi/api/spaces/$($otherSpace.id)/games?type=MATH" $childToken $null 403 | Out-Null
Send-Request POST "$gamesApi/api/spaces/$spaceId/games" $childToken @{ type = 'MATH'; title = 'Forbidden'; content = @{ expression = '1 + 1' } } 403 | Out-Null

$session = Send-Request POST "$gamesApi/api/spaces/$spaceId/games/$($game.id)/sessions" $childToken $null
$attempt = Send-Request POST "$gamesApi/api/spaces/$spaceId/sessions/$($session.id)/attempts" $childToken @{ idempotencyKey = [guid]::NewGuid().ToString(); answer = @{ value = 5 } }
if ($attempt.status -ne 'SUCCESS') { throw "The correct answer did not complete the session (status: $($attempt.status))." }

Send-Request GET "$progressApi/api/progress/spaces/$spaceId/summary" $parentToken $null | Out-Null
Write-Output 'PASS: parent register/login, owned space creation, game creation, child code login, game listing and play, role/space denial, parent progress authorization.'
Write-Output 'Note: this smoke test confirms Suivi access only. Progress events are not sent while the local RabbitMQ publisher is disabled.'
