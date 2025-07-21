import type { Context } from 'telegraf'
import type { Update } from 'telegraf/typings/core/types/typegram'

const authMiddleware = async (
  ctx: Context<Update>,
  next: () => Promise<void>
) => {
  if (ctx.from?.id === +process.env.ADMIN_USER_ID!) await next()
}

export default authMiddleware
