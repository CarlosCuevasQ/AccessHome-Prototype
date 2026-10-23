import assert from 'node:assert/strict'
import { test } from 'node:test'
import { guardService } from '../.test-build/services/guardService.js'
import { guardManagementService } from '../.test-build/services/guardManagementService.js'

test('caseta no usa cuentas ni datos de la demo local',async()=>{
  await assert.rejects(guardService.getDashboard(),/requiere una cuenta real de Supabase/)
  await assert.rejects(guardService.getHistory(),/requiere una cuenta real de Supabase/)
})

test('la gestión de guardias no simula datos en la demo local',async()=>{
  await assert.rejects(guardManagementService.list(),/requiere Supabase/)
  await assert.rejects(guardManagementService.setStatus('guardia',false),/requiere Supabase/)
})
