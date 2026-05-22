$p = "c:\repos\greens\src\pages\CaloriesPage.tsx"
$c = Get-Content $p
$new = $c[0..424] + $c[466..($c.Length-1)]
$new | Set-Content $p
