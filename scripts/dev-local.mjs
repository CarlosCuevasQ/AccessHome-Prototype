import { createServer } from 'vite'
// This process explicitly runs only the isolated local demo, even with .env.local present.
process.env.VITE_SUPABASE_URL=''
process.env.VITE_SUPABASE_PUBLISHABLE_KEY=''
const server=await createServer({server:{host:'127.0.0.1',port:5174,strictPort:true}})
await server.listen()
server.printUrls()
