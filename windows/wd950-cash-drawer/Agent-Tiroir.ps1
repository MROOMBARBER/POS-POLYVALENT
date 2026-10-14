$ErrorActionPreference='Stop'
$cfgPath=Join-Path $env:LOCALAPPDATA 'MamounPOS\drawer-config.json'
if(-not(Test-Path -LiteralPath $cfgPath)){
 Write-Host 'Executer 1_CONFIGURER_TIROIR.bat d abord.' -ForegroundColor Red
 exit 1
}
$config=Get-Content -LiteralPath $cfgPath -Raw -Encoding UTF8|ConvertFrom-Json
$printer=[string]$config.printerName
$pin=[byte]$config.connectorPin
$expectedOrigin='https://pos-polyvalent.vercel.app'
$port=17953
if(-not $printer -or $pin -notin @(0,1)){throw 'Configuration tiroir invalide'}
# A local Windows spooler RAW job is sent to the ESC/POS compatible printer.
# This is NEVER invoked by an order print and NEVER invoked on a TPE payment.
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class MamounCashDrawerRaw {
 [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Unicode)]
 public struct DOCINFO {
  [MarshalAs(UnmanagedType.LPWStr)] public string pDocName;
  [MarshalAs(UnmanagedType.LPWStr)] public string pOutputFile;
  [MarshalAs(UnmanagedType.LPWStr)] public string pDataType;
 }
 [DllImport("winspool.drv", EntryPoint="OpenPrinterW", CharSet=CharSet.Unicode, SetLastError=true)]
 public static extern bool OpenPrinter(string pPrinterName, out IntPtr phPrinter, IntPtr pDefault);
 [DllImport("winspool.drv", EntryPoint="ClosePrinter", SetLastError=true)]
 public static extern bool ClosePrinter(IntPtr hPrinter);
 [DllImport("winspool.drv", EntryPoint="StartDocPrinterW", CharSet=CharSet.Unicode, SetLastError=true)]
 public static extern int StartDocPrinter(IntPtr hPrinter, int level, ref DOCINFO di);
 [DllImport("winspool.drv", EntryPoint="EndDocPrinter", SetLastError=true)]
 public static extern bool EndDocPrinter(IntPtr hPrinter);
 [DllImport("winspool.drv", EntryPoint="StartPagePrinter", SetLastError=true)]
 public static extern bool StartPagePrinter(IntPtr hPrinter);
 [DllImport("winspool.drv", EntryPoint="EndPagePrinter", SetLastError=true)]
 public static extern bool EndPagePrinter(IntPtr hPrinter);
 [DllImport("winspool.drv", EntryPoint="WritePrinter", SetLastError=true)]
 public static extern bool WritePrinter(IntPtr hPrinter, byte[] bytes, int size, out int written);
 public static bool Pulse(string printer, byte pin) {
  IntPtr handle=IntPtr.Zero;
  if(!OpenPrinter(printer,out handle,IntPtr.Zero))throw new Exception("Impossible de joindre l imprimante Windows");
  try {
   DOCINFO di=new DOCINFO {pDocName="MAMOUN POS - ouverture tiroir",pDataType="RAW"};
   if(StartDocPrinter(handle,1,ref di)<=0)throw new Exception("Imprimante sans impression RAW ou pilote incompatible");
   try {
    if(!StartPagePrinter(handle))throw new Exception("StartPagePrinter a echoue");
    try {
     // Epson-style ESC p: pin 2 or 5; 90ms ON, 200ms OFF.
     byte[] payload=new byte[]{27,112,pin,45,100};
     int written=0;
     if(!WritePrinter(handle,payload,payload.Length,out written)||written!=payload.Length)throw new Exception("La commande ESC/POS a ete refusee");
    } finally {EndPagePrinter(handle);}
   } finally {EndDocPrinter(handle);}
   return true;
  }finally{ClosePrinter(handle);}
 }
}
'@
function Respond($stream,$status,$obj,$origin) {
 $json=$obj|ConvertTo-Json -Compress -Depth 3
 $bytes=[System.Text.Encoding]::UTF8.GetBytes($json)
 $phrase=switch($status){200{'OK'}403{'Forbidden'}404{'Not Found'}405{'Method Not Allowed'}429{'Too Many Requests'}503{'Service Unavailable'}default{'Bad Request'}}
 $head="HTTP/1.1 $status $phrase"+[char]13+[char]10+"Content-Type: application/json; charset=utf-8"+[char]13+[char]10+"Content-Length: $($bytes.Length)"+[char]13+[char]10+"Cache-Control: no-store"+[char]13+[char]10+"Connection: close"+[char]13+[char]10
 if($origin -eq $expectedOrigin){
  $head+="Access-Control-Allow-Origin: $expectedOrigin"+[char]13+[char]10
  $head+="Access-Control-Allow-Methods: GET, POST, OPTIONS"+[char]13+[char]10
  $head+="Access-Control-Allow-Headers: Content-Type"+[char]13+[char]10
  $head+="Access-Control-Allow-Private-Network: true"+[char]13+[char]10
  $head+="Vary: Origin"+[char]13+[char]10
 }
 $head+=[char]13+[char]10
 $pre=[System.Text.Encoding]::ASCII.GetBytes($head)
 $stream.Write($pre,0,$pre.Length)
 $stream.Write($bytes,0,$bytes.Length)
}
$listener=New-Object System.Net.Sockets.TcpListener([System.Net.IPAddress]::Loopback,$port)
$listener.Start(10)
$lastOpen=[DateTime]::MinValue
Write-Host ''
Write-Host 'MAMOUN POS - AGENT TIROIR ACTIF' -ForegroundColor Green
Write-Host ('Imprimante: '+$printer)
Write-Host ('Port local uniquement: 127.0.0.1:'+ $port)
Write-Host 'Garder cette fenetre ouverte pendant les encaissements cash.'
Write-Host 'Appuyer Ctrl+C pour arreter.'
Write-Host ''
try {
 while($true) {
  $client=$listener.AcceptTcpClient()
  try {
   $client.ReceiveTimeout=4500;$client.SendTimeout=4500
   $stream=$client.GetStream()
   $reader=[System.IO.StreamReader]::new($stream,[System.Text.Encoding]::ASCII,$false,1024,$true)
   $line=$reader.ReadLine()
   if(-not $line){continue}
   if($line.Length -gt 800){continue}
   $words=$line.Split(' ')
   if($words.Length -lt 2){continue}
   $method=$words[0];$path=$words[1]
   $origin=''
   for($i=0;$i -lt 45;$i++){
    $h=$reader.ReadLine()
    if($null -eq $h -or $h -eq ''){break}
    if($h.Length -gt 3000){break}
    if($h.StartsWith('Origin:',[StringComparison]::OrdinalIgnoreCase)){$origin=$h.Substring(7).Trim()}
   }
   if($origin -ne $expectedOrigin){
    Respond $stream 403 @{ok=$false;error='Origine refusee'} $origin
    continue
   }
   if($method -eq 'OPTIONS') {Respond $stream 200 @{ok=$true} $origin;continue}
   if($path -eq '/health' -and $method -eq 'GET'){
    Respond $stream 200 @{ok=$true;printer=$printer;pin=[int]$pin} $origin
    continue
   }
   if($path -eq '/open' -and $method -eq 'POST'){
    if(([DateTime]::UtcNow-$lastOpen).TotalMilliseconds -lt 2000){
     Respond $stream 429 @{ok=$false;error='Attendez 2 secondes entre deux ouvertures'} $origin
     continue
    }
    $lastOpen=[DateTime]::UtcNow
    try {
     [void][MamounCashDrawerRaw]::Pulse($printer,$pin)
     Write-Host 'Pulse tiroir envoyee' -ForegroundColor Green
     Respond $stream 200 @{ok=$true;message='Signal tiroir transmis a l imprimante'} $origin
    }catch{
     Write-Host $_.Exception.Message -ForegroundColor Red
     Respond $stream 503 @{ok=$false;error='Commande tiroir refusee. Verifiez compatibilite ESC/POS et RJ11/RJ12.'} $origin
    }
    continue
   }
   Respond $stream 404 @{ok=$false;error='Route inconnue'} $origin
  }catch{Write-Host ('Connexion locale: '+$_.Exception.Message) -ForegroundColor DarkYellow}
  finally{$client.Close()}
 }
}finally{$listener.Stop()}
