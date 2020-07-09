const hex = string => '0x' + Buffer.from(string).toString('hex');

module.exports = {
  hex,
};
