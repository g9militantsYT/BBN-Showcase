// Import required libraries
require('dotenv').config();
const { Client, MessageEmbed } = require('discord.js');
const dns = require('dns');
const util = require('minecraft-server-util');

// Create a new Discord client
const client = new Client();

// Define the channel ID you want to monitor
const channelIdToMonitor = '1151560216324874330'; // Replace with your channel's ID

// Define the emoji you want to react with
const reactionEmoji = '👍'; // Replace with your desired emoji

const targetDomains = ['hel1.bbn.one', 'fsn1.bbn.one', 'sgp1.bbn.one', 'mum1.bbn.one'];

client.on('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
});

client.on('message', async (message) => {
  if (message.channel.id === channelIdToMonitor) { // Check if the message is in the specified channel
    // React to the message with the specified emoji
    try {
      await message.react(reactionEmoji);
      console.log(`Reacted with ${reactionEmoji} to a message in the monitored channel.`);
    } catch (error) {
      console.error('Error reacting to message:', error);
    }
  }

  if (message.author.bot) return; // Ignore messages from bots
  if (message.channel.name === commands) {
    // Timeout the user for 1 minute
    if (!message.member.roles.cache.some(role => role.name === 'Timeout')) {
      try {
        const timeoutRole = message.guild.roles.cache.find(role => role.name === 'Timeout');
        if (timeoutRole) {
          await message.member.roles.add(timeoutRole);
          setTimeout(async () => {
            await message.member.roles.remove(timeoutRole);
          }, 60000); // Timeout for 1 minute (60000 milliseconds)
        }
      } catch (error) {
        console.error('Error applying timeout:', error);
      }
    }

    // Check if the message contains a domain name and port number
    const domainPattern = /(?:https?:\/\/)?(?:www\.)?([a-zA-Z0-9.-]+(?:\.[a-zA-Z]{2,}))(?::([0-9]+))?/;
    const match = domainPattern.exec(message.content);
    
    if (match) {
      const userDomain = match[1];
      const userPort = match[2] ? parseInt(match[2]) : null;

      if (!userPort) {
        try {
          const reply = await message.reply('Please provide a port number after the domain name.');
          console.log(`Deleted message from ${message.author.tag} due to missing port number.`);
          
          setTimeout(async () => {
            try {
              await reply.delete();
              console.log(`Deleted reply to ${message.author.tag} about missing port number.`);
            } catch (error) {
              console.error('Error deleting reply:', error);
            }
          }, 10000); // Auto delete reply after 10 seconds
          
          try {
            await message.delete();
            console.log(`Deleted message from ${message.author.tag} due to missing port number.`);
          } catch (error) {
            console.error('Error deleting message:', error);
          }
          return;
        } catch (error) {
          console.error('Error replying to message:', error);
        }
      }

      try {
        // Resolve IP addresses for both domains
        const [userIp, targetIps] = await Promise.all([
          resolveDomainToIp(userDomain),
          Promise.all(targetDomains.map(domain => resolveDomainToIp(domain).catch(() => null))) // Add error handling
        ]);

        // Compare IPs and provide responses
        if (targetDomains.includes(userDomain)) {
          message.react('👍') // React with a thumbs-up emoji
            .catch(error => console.error('Error reacting:', error));
        } else if (targetIps.includes(userIp) && userIp !== null) {
          message.react('✅') // React with a white checkmark emoji
            .catch(error => console.error('Error reacting:', error));
        } else {
          const userDomainIp = await resolveDomainToIp(userDomain).catch(() => null); // Add error handling
          if (userDomainIp === null) {
            const replyMessage = await message.reply(`Nope bro, wrong domain. Couldn't resolve IP address for ${userDomain}`);
            const countdownMessage = await message.channel.send('Countdown: 10 seconds left');
            const endTime = Date.now() + 10000; // Calculate end time of countdown

            const interval = setInterval(async () => {
              const remainingTime = endTime - Date.now();
              if (remainingTime <= 0) {
                clearInterval(interval);
                try {
                  await replyMessage.delete();
                  await message.delete();
                  await countdownMessage.delete();
                } catch (error) {
                  console.error('Error deleting message:', error);
                }
              } else {
                await countdownMessage.edit(`Countdown: ${Math.ceil(remainingTime / 1000)} seconds left`);
              }
            }, 1000);
            
            setTimeout(async () => {
              clearInterval(interval);
              try {
                await replyMessage.delete();
                await message.delete();
                await countdownMessage.delete();
              } catch (error) {
                console.error('Error deleting message:', error);
              }
            }, 10000); // Auto delete message, reply, and countdown after 10 seconds
          } else {
            // Check if the user's provided domain is in the format of a Minecraft server IP:Port
            const minecraftPattern = /([a-zA-Z0-9.-]+):(\d+)/;
            const minecraftMatch = minecraftPattern.exec(userDomain);
            
            if (minecraftMatch) {
              const serverIp = minecraftMatch[1];
              const serverPort = parseInt(minecraftMatch[2]);

              try {
                const serverStatus = await util.status(serverIp, { port: serverPort });

                const embed = createMinecraftEmbed(serverIp, serverPort, serverStatus);
                message.reply({ embeds: [embed] });
              } catch (error) {
                console.error('Error querying Minecraft server:', error);
                message.reply(`Oops! An error occurred while querying the Minecraft server.`);
              }
            } else {
              const replyMessage = await message.reply(`Nope bro, wrong domain. IP address for ${userDomain}: ||${userDomainIp}||`);
            }
          }
        }
      } catch (error) {
        console.error('Error resolving domain:', error);
        message.reply(`Oops! An error occurred while processing the domain.`);
      }
    } else {
      const reply = await message.reply('Include a domain name plz');
      const countdownMessage = await message.channel.send('Countdown: 10 seconds left');
      const endTime = Date.now() + 10000; // Calculate end time of countdown

      const interval = setInterval(async () => {
        const remainingTime = endTime - Date.now();
        if (remainingTime <= 0) {
          clearInterval(interval);
          try {
            await reply.delete();
            await message.delete();
            await countdownMessage.delete();
          } catch (error) {
            console.error('Error deleting message:', error);
          }
        } else {
          await countdownMessage.edit(`Countdown: ${Math.ceil(remainingTime / 1000)} seconds left`);
        }
      }, 1000);
      
      setTimeout(async () => {
        clearInterval(interval);
        try {
          await reply.delete();
          await message.delete();
          await countdownMessage.delete();
        } catch (error) {
          console.error('Error deleting message:', error);
        }
      }, 10000); // Auto delete message, reply, and countdown after 10 seconds
    }
  }
});

async function resolveDomainToIp(domain) {
  return new Promise((resolve, reject) => {
    dns.resolve(domain, (err, addresses) => {
      if (err) {
        reject(err);
      } else {
        resolve(addresses[0]);
      }
    });
  });
}

function createMinecraftEmbed(serverIp, serverPort, serverStatus) {
  const embed = new MessageEmbed()
    .setTitle(`Minecraft Server Info`)
    .setColor('#0099ff')
    .addField('Server IP', `${serverIp}:${serverPort}`)
    .addField('Players Online', `${serverStatus.onlinePlayers}/${serverStatus.maxPlayers}`)
    .addField('MOTD', serverStatus.description.text)
    .setTimestamp();
  return embed;
}

client.login(process.env.BOT_TOKEN);
