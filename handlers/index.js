module.exports = {
  handleError: require('./catch'),
  handleStart: require('./start'),
  handleHelp: require('./help'),
  handleDonate: require('./donate'),
  handleSticker: require('./sticker'),
  handleDeleteSticker: require('./sticker-delete'),
  handleRestoreSticker: require('./sticker-restore'),
  handlePacks: require('./packs'),
  handleSelectPack: require('./pack-select'),
  handleHidePack: require('./pack-hide'),
  handleRestorePack: require('./pack-restore'),
  handleCopyPack: require('./pack-copy'),
  handleCoedit: require('./coedit'),
  handleCatalog: require('./catalog'),
  handleLanguage: require('./language'),
  handleEmoji: require('./emoji'),
  handleAboutUser: require('./user-about'),
  handleStickerUpade: require('./sticker-update'),
  handleInlineQuery: require('./inline-query'),
  handleBoostPack: require('./pack-boost')
}
