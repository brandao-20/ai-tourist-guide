function toPlainModel(model) {
  if (!model) {
    return null;
  }

  return typeof model.get === 'function' ? model.get({ plain: true }) : model;
}

module.exports = {
  toPlainModel,
};
