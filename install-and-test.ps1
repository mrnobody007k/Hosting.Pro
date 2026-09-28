$ErrorActionPreference = 'Stop'

Write-Host "== Platform environment check ==" -ForegroundColor Cyan
node --version
npm --version

Write-Host "`n== npm registry check ==" -ForegroundColor Cyan
$registry = npm config get registry
Write-Host "Registry: $registry"
npm ping

Write-Host "`n== Installing dependencies ==" -ForegroundColor Cyan
npm install

Write-Host "`n== Prisma client ==" -ForegroundColor Cyan
npm run db:generate

Write-Host "`n== TypeScript check ==" -ForegroundColor Cyan
npx tsc --noEmit

Write-Host "`n== Production build ==" -ForegroundColor Cyan
npm run build

Write-Host "`nBUILD PASSED. Database migration/seed and runtime tests still require a valid .env DATABASE_URL." -ForegroundColor Green
