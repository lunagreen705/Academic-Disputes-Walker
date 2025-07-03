// botManager.js
module.exports = {
  listGuilds(client) {
    return client.guilds.cache.map(guild => ({
      id: guild.id,
      name: guild.name,
      memberCount: guild.memberCount,
      ownerId: guild.ownerId,
      ownerTag: guild.members.cache.get(guild.ownerId)?.user.tag || "未知"
    }));
  },

  getGuildInfo(client, guildId) {
    const guild = client.guilds.cache.get(guildId);
    if (!guild) throw new Error("找不到指定的伺服器ID");

    return {
      id: guild.id,
      name: guild.name,
      memberCount: guild.memberCount,
      ownerId: guild.ownerId,
      ownerTag: guild.members.cache.get(guild.ownerId)?.user.tag || "未知",
      region: guild.preferredLocale || "未知",
      channelsCount: guild.channels.cache.size,
      rolesCount: guild.roles.cache.size,
      createdAt: guild.createdAt.toISOString(),
      mePermissions: guild.members.me.permissions.toArray(),
    };
  },

  async leaveGuild(client, guildId) {
    const guild = client.guilds.cache.get(guildId);
    if (!guild) throw new Error("找不到指定的伺服器ID");

    await guild.leave();
    return guild.name;
  }
};

