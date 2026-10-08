import assert from 'node:assert/strict'
import { test } from 'node:test'
import { csvCell, shiftCsv, shiftCsvHeaders, shiftCsvFilename, shiftLocalParts } from '../.test-build/utils/shiftCsv.js'
import { formatDate } from '../.test-build/utils/dates.js'

test('CSV neutraliza fórmulas y conserva comillas, saltos y caracteres españoles',()=>{
 for(const value of ['=1+1','+CMD','-2+1','@SUM(A1)','  =1','\t=1','\r=1','\n=1']) assert.ok(csvCell(value).startsWith('"\''))
 assert.equal(csvCell('Casa "24", aquí'),'"Casa ""24"", aquí"')
 const csv=shiftCsv([{...item,guard:'=formula',notes:'Una línea\notra'}],zone)
 assert.ok(csv.startsWith('\uFEFF'));assert.ok(csv.includes('"\'=formula"'));assert.ok(csv.includes('"Una línea\notra"'))
})

const zone='America/Mexico_City'
const item={occurredAt:'2020-01-03T05:30:00Z',type:'visitor',inPeriod:true,movement:'Entrada',name:'José "López", García',company:'',category:'',residence:'Casa 24',vehicle:'Sedán azul',plates:'ABC-123',method:'QR',result:'Autorizado',arrivalAt:null,entryAt:'2020-01-03T05:30:00Z',exitAt:null,pendingExit:true,guard:'Claudia',notes:'',token:'SECRET_TOKEN',request_id:'SECRET_REQUEST',source_ids:['SECRET_SOURCE'],command_input:'SECRET_INPUT',id:'SECRET_ID'}
// Minimal independent RFC4180 parser used to assert rectangular CSV with multiline cells.
function parse(csv) {
 const rows=[];let row=[],cell='',quoted=false
 const text=csv.replace(/^\uFEFF/,'')
 for(let i=0;i<text.length;i++) {
  const ch=text[i]
  if(ch==='"') {if(quoted&&text[i+1]==='"') {cell+='"';i++} else quoted=!quoted}
  else if(ch===','&&!quoted) {row.push(cell);cell=''}
  else if(ch==='\r'&&text[i+1]==='\n'&&!quoted) {row.push(cell);rows.push(row);row=[];cell='';i++}
  else cell+=ch
 }
 assert.equal(quoted,false);return rows
}
test('CSV rectangular: 20 encabezados, fila por evento, vacíos y acentos sin IDs/JSON/tokens',()=>{
 const service={...item,type:'service',name:'Juan Pérez',company:'Amazon',category:'paqueteria',movement:'Rechazo',result:'Rechazado',vehicle:'',method:'',arrivalAt:'2020-01-03T05:20:00Z',entryAt:null,pendingExit:false,notes:'Motivo, "destino"\r\nOtra línea',inPeriod:false}
 const csv=shiftCsv([item,{...item,movement:'Salida',method:'MANUAL',exitAt:'2020-01-03T05:40:00Z',pendingExit:false},service],zone)
 const rows=parse(csv)
 assert.equal(rows.length,4);assert.deepEqual(rows[0],shiftCsvHeaders)
 for(const row of rows) assert.equal(row.length,20)
 assert.deepEqual(rows[1].slice(0,5),['2020-01-02','23:30:00','Visitante','Entrada','José "López", García'])
 assert.deepEqual(rows[1].slice(5,8),['','','Casa 24'])
 assert.equal(rows[1][12],'');assert.equal(rows[1][14],'');assert.equal(rows[1][17],'Sí')
 assert.equal(rows[2][10],'MANUAL');assert.equal(rows[2][14],'2020-01-02 23:40:00')
 assert.equal(rows[3][6],'Paquetería');assert.equal(rows[3][16],service.notes)
 assert.equal(rows[3][18],'Pendiente fuera del periodo');assert.equal(rows[3][19],zone)
 for(const forbidden of ['SECRET','token','source_ids','request_id','command_input','{"']) assert.equal(csv.includes(forbidden),false)
 assert.equal(Buffer.from(csv,'utf8').toString('utf8'),csv)
 assert.equal(shiftCsvFilename(item.occurredAt,zone),'accesshome-reporte-caseta-2020-01-02.csv')
 assert.deepEqual(shiftLocalParts(item.occurredAt,zone),{date:'2020-01-02',time:'23:30:00'})
 assert.equal(parse(shiftCsv([],zone)).length,1)
})
test('fecha de frontera se muestra en zona del condominio sin usar la zona del dispositivo',()=>{
 const expected=new Intl.DateTimeFormat('es-MX',{dateStyle:'medium',timeStyle:'short',timeZone:'America/Mexico_City'}).format(new Date('2020-01-03T05:30:00Z'))
 assert.equal(formatDate('2020-01-03T05:30:00Z','America/Mexico_City'),expected)
 assert.ok(expected.includes('2'))
})
