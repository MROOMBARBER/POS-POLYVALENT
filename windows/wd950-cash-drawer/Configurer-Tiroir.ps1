$ErrorActionPreference='Stop'
Write-Host ''
Write-Host '===========================================' -ForegroundColor Cyan
Write-Host ' MAMOUN POS - Tiroir caisse WD950 USB 80mm ' -ForegroundColor Cyan
Write-Host '==========================================='
Write-Host 'Brancher le tiroir via RJ11/RJ12 a la prise DK de l imprimante.'
Write-Host 'Ne pas brancher directement au port reseau du PC.'
Write-Host ''
$dir=Join-Path $env:LOCALAPPDATA 'MamounPOS'
New-Item -Path $dir -ItemType Directory -Force | Out-Null
$printers=@(Get-CimInstance -ClassName Win32_Printer | Sort-Object Name)
if($printers.Count -eq 0){Write-Host 'Aucune imprimante Windows detectee.' -ForegroundColor Red;exit 1}
for($i=0;$i -lt $printers.Count;$i++){
 $p=$printers[$i]
 Write-Host ("{0}) {1}" -f ($i+1),$p.Name)
}
$inputNumber=Read-Host 'Numero de votre imprimante ticket 80mm'
[int]$index=0
if(-not [int]::TryParse($inputNumber,[ref]$index) -or $index -lt 1 -or $index -gt $printers.Count){Write-Host 'Numero invalide.' -ForegroundColor Red;exit 2}
$choice=Read-Host 'Broche du tiroir: 0 (standard, pin 2) ou 1 (pin 5) [0]'
if($choice -eq ''){$choice='0'}
if($choice -notin @('0','1')){Write-Host 'Broche invalide.' -ForegroundColor Red;exit 3}
$cfg=[ordered]@{printerName=[string]$printers[$index-1].Name;connectorPin=[int]$choice;siteOrigin='https://pos-polyvalent.vercel.app';port=17953}
$file=Join-Path $dir 'drawer-config.json'
$cfg|ConvertTo-Json -Depth 3|Set-Content -LiteralPath $file -Encoding UTF8
Write-Host ''
Write-Host ('OK! Imprimante: '+$cfg.printerName) -ForegroundColor Green
Write-Host ('Configuration locale: '+$file)
Write-Host 'Ensuite lancer 2_DEMARRER_AGENT_TIROIR.bat et laisser ouvert.'
Write-Host 'Desactiver ouverture automatique du tiroir sur chaque ticket dans les preferences du pilote.'
