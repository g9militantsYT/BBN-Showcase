// Import necessary modules
const { Client, MessageEmbed } = require('discord.js');
const dns = require('dns');
const util = require('minecraft-server-util');
require('dotenv').config(); // Load environment variables from a .env file

// Create a Discord client
const client = new Client();

// Define the name of the channel to monitor and target domains
const channelName = 'commands'; // Replace with the name of the channel you want to monitor
const targetDomains = ['hel1.bbn.one', 'fsn1.bbn.one', 'sgp1.bbn.one', 'mum1.bbn.one'];

// Event handler for when the bot is ready
client.on('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
});

// Event handler for incoming messages
client.on('message', async (message) => {
  if (message.author.bot) return; // Ignore messages from bots
  if (message.channel.name === channelName) {
    // Timeout the user for 1 minute if they don't have the 'Timeout' role
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
        // Resolve IP addresses for both user's domain and target domains
        const [userIp, targetIps] = await Promise.all([
          resolveDomainToIp(userDomain),
          Promise.all(targetDomains.map(domain => resolveDomainToIp(domain).catch(() => null)))
        ]);

        // Compare IPs and provide responses
        if (targetDomains.includes(userDomain)) {
          // If the user's domain is in the target domains, react with a thumbs-up emoji
          message.react('👍').catch(error => console.error('Error reacting:', error));

          // Create an embed with server IP and port
          const embed = {
            title: `${userDomain}:${userPort}`,
            description: `${message.content}`, // Set the description to the user's full message
            color: 0x00ff00, // Green color
          };

          // Send the embed to the Discord channel
          message.channel.send({ embed }).catch(error => console.error('Error sending embed:', error));
        } else if (targetIps.includes(userIp) && userIp !== null) {
          // If the user's IP is in target IPs and not null, react with a white checkmark emoji
          message.react('✅').catch(error => console.error('Error reacting:', error));

          // Create an embed with server IP and port
          const embed = {
            title: `${userDomain}:${userPort}`,
            description: `${message.content}`,
            color: 0x00ff00,
            author: {
              name: message.author.username,
              icon_url: message.author.avatarURL(),
            },
            footer: {
              text: 'BBN Hosting',
            },
          };

          // Send the embed to the Discord channel
          message.channel.send({ embed }).catch(error => console.error('Error sending embed:', error));
        }
      } catch (error) {
        console.error('Error resolving domain:', error);
        message.reply(`Oops! An error occurred while processing the domain.`);
      }
    } else {
      // If the message doesn't contain a domain, provide instructions and a countdown
      const reply = await message.reply('Include a domain name please');
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

// Function to resolve a domain to an IP address using DNS
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

// Login to Discord using the bot token from the environment variables
client.login(process.env.BOT_TOKEN);