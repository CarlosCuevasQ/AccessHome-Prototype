import assert from 'node:assert/strict'
import { test } from 'node:test'
import { csvCell, shiftCsv } from '../.test-build/utils/shiftCsv.js'
import { formatDate } from '../.test-build/utils/dates.js'

test('CSV neutraliza fórmulas y conserva comillas, saltos y caracteres españoles',()=>{
 for(const value of ['=1+1','+CMD','-2+1','@SUM(A1)','  =1','\t=1','\r=1','\n=1']) assert.ok(csvCell(value).startsWith('"\''))
 assert.equal(csvCell('Casa "24", aquí'),'"Casa ""24"", aquí"')
 const csv=shiftCsv({id:'fixture',guard_name:'=formula',condominium_name:'Prueba',time_zone:'America/Mexico_City',period_start:'2020-01-02T13:00:00Z',period_end:'2020-01-02T21:00:00Z',generated_at:'2020-01-02T21:01:00Z',status:'finalizado',metric_version:1,metrics:{visitorEntries:2,visitorExits:1,serviceArrivals:3,serviceEntries:2,serviceExits:1,serviceRejections:1,openVisits:1,openServices:1,visitorRejections:null},notes:'Una línea\notra',incidents:'Sin incidencias'})
 assert.ok(csv.startsWith('\uFEFF'));assert.ok(csv.includes('"\'=formula"'));assert.ok(csv.includes('"No disponible"'));assert.ok(csv.includes('"Una línea\notra"'))
})
test('fecha de frontera se muestra en zona del condominio sin usar la zona del dispositivo',()=>{
 const expected=new Intl.DateTimeFormat('es-MX',{dateStyle:'medium',timeStyle:'short',timeZone:'America/Mexico_City'}).format(new Date('2020-01-03T05:30:00Z'))
 assert.equal(formatDate('2020-01-03T05:30:00Z','America/Mexico_City'),expected)
 assert.ok(expected.includes('2'))
})
