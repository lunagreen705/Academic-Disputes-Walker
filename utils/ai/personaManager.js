const personaMap = new Map();

function setPersona(guildId, personaName) {
  personaMap.set(guildId, personaName);
}

function getPersona(guildId) {
  return personaMap.get(guildId) || 'default';
}

module.exports = {
  setPersona,
  getPersona,
};