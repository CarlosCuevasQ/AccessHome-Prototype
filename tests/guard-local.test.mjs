import assert from 'node:assert/strict'
import { test } from 'node:test'
import { guardService } from '../.test-build/services/guardService.js'

test('caseta no usa cuentas ni datos de la demo local',async()=>{
  await assert.rejects(guardService.getDashboard(),/requiere una cuenta real de Supabase/)
  await assert.rejects(guardService.getHistory(),/requiere una cuenta real de Supabase/)
})
