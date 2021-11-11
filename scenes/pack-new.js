const Scene = require('telegraf/scenes/base')
const Markup = require('telegraf/markup')
const {
  rword
} = require('rword')
const {
  handleStart
} = require('../handlers')
const { addSticker } = require('../utils')

const escapeHTML = (str) => str.replace(
  /[&<>'"]/g,
  (tag) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;'
  }[tag] || tag)
)

const сhoosePackType = new Scene('сhoosePackType')

сhoosePackType.enter(async (ctx) => {
  ctx.session.scene.newPack = {}
  await ctx.replyWithHTML(ctx.i18n.t('scenes.new_pack.pack_type'), {
    reply_markup: Markup.keyboard([
      [
        ctx.i18n.t('scenes.new_pack.common'),
        ctx.i18n.t('scenes.new_pack.inline'),
        ctx.i18n.t('scenes.new_pack.animated')
      ],
      [
        ctx.i18n.t('scenes.btn.cancel')
      ]
    ]).resize()
  })
})
сhoosePackType.on('message', async (ctx) => {
  if (ctx.message.text === ctx.i18n.t('scenes.new_pack.animated')) {
    ctx.session.scene.newPack.animated = true
    return ctx.scene.enter('newPackTitle')
  } else if (ctx.message.text === ctx.i18n.t('scenes.new_pack.inline')) {
    ctx.session.scene.newPack.inline = true
    return ctx.scene.enter('newPackTitle')
  } else if (ctx.message.text === ctx.i18n.t('scenes.new_pack.common')) {
    ctx.session.scene.newPack.animated = false
    return ctx.scene.enter('newPackTitle')
  } else {
    return ctx.scene.reenter()
  }
})

const newPackTitle = new Scene('newPackTitle')

newPackTitle.enter(async (ctx) => {
  if (!ctx.session.scene.newPack) ctx.session.scene.newPack = { animated: ctx.session.scene.copyPack.is_animated }
  const generatedName = rword.generate(3, { length: '3-5', capitalize: 'first' }).join('')
  await ctx.replyWithHTML(ctx.i18n.t('scenes.new_pack.pack_title'), {
    reply_markup: Markup.keyboard([
      [
        generatedName
      ],
      [
        ctx.i18n.t('scenes.btn.cancel')
      ]
    ]).resize()
  })
})
newPackTitle.on('message', async (ctx) => {
  if (ctx.message.text && ctx.message.text.length <= ctx.config.charTitleMax) {
    ctx.session.scene.newPack.title = ctx.message.text
    if (ctx.session.scene.newPack.inline) return ctx.scene.enter('newPackConfirm')
    else return ctx.scene.enter('newPackName')
  } else {
    await ctx.replyWithHTML(ctx.i18n.t('scenes.new_pack.error.title_long', {
      max: ctx.config.charTitleMax
    }), {
      reply_to_message_id: ctx.message.message_id
    })
  }
})

const newPackName = new Scene('newPackName')

newPackName.enter((ctx) => ctx.replyWithHTML(ctx.i18n.t('scenes.new_pack.pack_name'), {
  reply_to_message_id: ctx.message.message_id
}))

newPackName.on('message', async (ctx) => {
  return ctx.scene.enter('newPackConfirm')
})

const newPackConfirm = new Scene('newPackConfirm')

newPackConfirm.enter(async (ctx) => {
  if (ctx.message.text && ctx.message.text.length <= ctx.config.charNameMax) {
    if (!ctx.session.userInfo) ctx.session.userInfo = await ctx.db.User.getData(ctx.from)

    const inline = !!ctx.session.scene.newPack.inline
    ctx.session.scene.newPack.name = ctx.message.text

    const nameSuffix = `_by_${ctx.options.username}`
    const titleSuffix = ` :: @${ctx.options.username}`

    let { name, title, animated } = ctx.session.scene.newPack

    if (!inline) name += nameSuffix
    if (ctx.session.userInfo.premium !== true && !inline) title += titleSuffix

    const stickers = { emojis: '🌟' }
    if (animated) {
      stickers.tgs_sticker = { source: 'sticker_placeholder.tgs' }
    } else {
      stickers.png_sticker = { source: 'sticker_placeholder.png' }
    }

    let createNewStickerSet

    if (inline) {
      createNewStickerSet = true
    } else {
      const stickerSetByName = await ctx.db.StickerSet.findOne({ name })

      if (stickerSetByName) {
        await ctx.replyWithHTML(ctx.i18n.t('scenes.new_pack.error.telegram.name_occupied'), {
          reply_to_message_id: ctx.message.message_id
        })
        return ctx.scene.enter('newPackName')
      }

      createNewStickerSet = await ctx.telegram.createNewStickerSet(ctx.from.id, name, title, stickers).catch((error) => {
        return { error }
      })

      if (createNewStickerSet.error) {
        const { error } = createNewStickerSet

        if (error.description === 'Bad Request: invalid sticker set name is specified') {
          await ctx.replyWithHTML(ctx.i18n.t('scenes.new_pack.error.telegram.name_invalid'), {
            reply_to_message_id: ctx.message.message_id
          })
          return ctx.scene.enter('newPackName')
        } else if (error.description === 'Bad Request: sticker set name is already occupied') {
          await ctx.replyWithHTML(ctx.i18n.t('scenes.new_pack.error.telegram.name_occupied'), {
            reply_to_message_id: ctx.message.message_id
          })
          return ctx.scene.enter('newPackName')
        } else {
          await ctx.replyWithHTML(ctx.i18n.t('error.telegram', {
            error: error.description
          }), {
            reply_to_message_id: ctx.message.message_id
          })
          return ctx.scene.enter('newPackName')
        }
      }
    }

    if (createNewStickerSet) {
      if (!inline) {
        const getStickerSet = await ctx.telegram.getStickerSet(name)
        const stickerInfo = getStickerSet.stickers.slice(-1)[0]
        await ctx.telegram.deleteStickerFromSet(stickerInfo.file_id)
      }

      const userStickerSet = await ctx.db.StickerSet.newSet({
        owner: ctx.session.userInfo.id,
        name,
        title,
        animated,
        inline,
        emojiSuffix: '🌟',
        create: true
      })

      if (ctx.session.scene.newPack.animated) {
        ctx.session.userInfo.animatedStickerSet = userStickerSet
      } else {
        ctx.session.userInfo.stickerSet = userStickerSet
      }

      if (inline) {
        ctx.session.userInfo.inlineStickerSet = userStickerSet
        await ctx.replyWithHTML(ctx.i18n.t('callback.pack.set_inline_pack', {
          title: escapeHTML(userStickerSet.title),
          botUsername: ctx.options.username
        }), {
          reply_to_message_id: ctx.message.message_id,
          reply_markup: Markup.inlineKeyboard([
            Markup.switchToChatButton(ctx.i18n.t('callback.pack.btn.use_pack'), '')
          ])
        })
      } else {
        await ctx.replyWithHTML(ctx.i18n.t('scenes.new_pack.ok', {
          title: escapeHTML(title),
          link: `${ctx.config.stickerLinkPrefix}${name}`
        }), {
          reply_to_message_id: ctx.message.message_id
        })
      }

      if (ctx.session.scene.copyPack) {
        (async () => {
          const originalPack = ctx.session.scene.copyPack

          const message = await ctx.replyWithHTML(ctx.i18n.t('scenes.copy.progress', {
            originalTitle: originalPack.title,
            originalLink: `${ctx.config.stickerLinkPrefix}${originalPack.name}`,
            title: escapeHTML(title),
            link: `${ctx.config.stickerLinkPrefix}${name}`,
            current: 0,
            total: originalPack.stickers.length
          }))

          for (let index = 0; index < originalPack.stickers.length; index++) {
            await addSticker(ctx, originalPack.stickers[index])

            await ctx.telegram.editMessageText(
              message.chat.id, message.message_id, null,
              ctx.i18n.t('scenes.copy.progress', {
                originalTitle: originalPack.title,
                originalLink: `${ctx.config.stickerLinkPrefix}${originalPack.name}`,
                title: escapeHTML(title),
                link: `${ctx.config.stickerLinkPrefix}${name}`,
                current: index,
                total: originalPack.stickers.length
              }),
              { parse_mode: 'HTML' }
            ).catch(() => { })
          }

          await ctx.telegram.editMessageText(
            message.chat.id, message.message_id, null,
            ctx.i18n.t('scenes.copy.done', {
              originalTitle: originalPack.title,
              originalLink: `${ctx.config.stickerLinkPrefix}${originalPack.name}`,
              title: escapeHTML(title),
              link: `${ctx.config.stickerLinkPrefix}${name}`
            }),
            { parse_mode: 'HTML' }
          )

          ctx.scene.leave()
          handleStart(ctx)
        })()
      } else {
        ctx.scene.leave()
        handleStart(ctx)
      }
    }
  } else {
    await ctx.replyWithHTML(ctx.i18n.t('scenes.new_pack.error.name_long', {
      max: ctx.config.charNameMax
    }), {
      reply_to_message_id: ctx.message.message_id
    })
  }
})

module.exports = [сhoosePackType, newPackTitle, newPackName, newPackConfirm]
