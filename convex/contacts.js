import { query } from "./_generated/server"
import {internal} from "./_generated/api"

export const getAllContacts=query({
  handler:async(ctx)=>{
    const CurrentUser = await ctx.runQuery(internal.users.getCurrentUser)
  }
})