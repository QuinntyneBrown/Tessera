param(
  [Parameter(Mandatory=$true)][string]$Destination,
  [string]$Voice = 'Microsoft Zira Desktop'
)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Speech
$taskSynth = New-Object System.Speech.Synthesis.SpeechSynthesizer
try {
  $taskSynth.SelectVoice($Voice)
  $taskSynth.Rate = 0
  $taskSynth.Volume = 100
  $taskFormat = New-Object System.Speech.AudioFormat.SpeechAudioFormatInfo(22050, [System.Speech.AudioFormat.AudioBitsPerSample]::Sixteen, [System.Speech.AudioFormat.AudioChannel]::Mono)
  New-Item -ItemType Directory -Path $Destination -Force | Out-Null
  $taskSegments = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'storyboard.json') -Raw | ConvertFrom-Json
  foreach ($taskSegment in $taskSegments) {
    $taskSynth.SetOutputToWaveFile((Join-Path $Destination ($taskSegment.id + '.wav')), $taskFormat)
    $taskSynth.Speak($taskSegment.speech)
    $taskSynth.SetOutputToNull()
  }
} finally {
  $taskSynth.Dispose()
}
