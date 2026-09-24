// Envuelve un handler async de Express para que las excepciones lleguen
// automaticamente al middleware de errores (evita try/catch repetido).
function asyncHandler(fn) {
  return function wrapped(req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = asyncHandler;
