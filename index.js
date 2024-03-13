const Discord = require('discord.js');
const sqlite3 = require('sqlite3');
const path = require('path');

const client = new Discord.Client();
const { prefix, token } = require('./config.json');
const adminRole = "";
const todoChannel = "";
const n = 300;

const codes = [
  'Not started',
  'Started',
  'In progress',
  'Paused',
  'Researching',
  'Dropped',
  'Completed'
]

const availableCmds = ['todo']

var todo;
var commandData;

client.on('ready', () => {
  console.log(`Logged in as ${client.user.tag}!`);

  todo = new sqlite3.Database(path.resolve(__dirname, 'todo.db'), (err) => {
    if (err) {
      return console.error(err.message);
    }
    console.log('SQLite connection established.');
  });

  // todo.run('CREATE TABLE tasks (user VARCHAR(18), id NOT NULL, title VARCHAR(256), description VARCHAR(2048), appointedBy VARCHAR(50), date VARCHAR(50), progress TINYINT DEFAULT 0, note VARCHAR(1024) DEFAULT \'\')');
});

client.on('message', message => {
  if (commandData != null && commandData.id === message.author.id) {
    switch (commandData.type) {
      case 'todo.new.title':
        message.channel.send('Enter the assignment description.');
        commandData.type = 'todo.new.desc';
        commandData.title = message.content;

        setTimeout(function() {
          if (commandData == null) return;
          commandData = null;
          message.channel.send("Command exited.");
        }, n * 1000);

        break;
      case 'todo.new.desc':
        const embed = new Discord.RichEmbed()
          .setColor('#f44242')
          .setAuthor('New Assignment Added')
          .addField(commandData.title, message.content)
          .setTimestamp()

        const embedPM = new Discord.RichEmbed()
          .setColor('#f44242')
          .setAuthor(message.author.username + ' has appointed a new assignment for you:')
          .addField(commandData.title, message.content)
          .setTimestamp()

        message.channel.send(embed);

        let target = commandData.target;

        var assign = function(targetId) {
          getTasksCount(targetId, count => {
            var taskId = 1;
            if (count !== undefined) taskId = ++count;
  
            assignTask(targetId, taskId, commandData.title, message.content, message.author.username);
  
            target.send(embedPM);
          });
        };

        if (target instanceof Discord.User) {
          assign(target.id);
        } else {
          target.members.forEach(member => {
            assign(member.id);
          });
        }
        
        commandData = null;
      break;
    }
    return;
  }

  if (!message.content.startsWith(prefix) || message.author.bot) return;

  const args = message.content.slice(prefix.length).split(' ');
  const command = args.shift().toLowerCase();
  const userId = message.author.id;
  const channel = message.channel;

  switch (command) {
    case 'help':
      if (args.length < 1) {
        return channel.send(':warning: | You must specify a command. Available commands: `' + availableCmds.join(', ') +
 '`');
      }

      switch (args[0].toLowerCase()) {
        case 'todo':
          channel.send('`/todo new|assign <user|role>` -- Assign a new assignment to the specified target.\n' +
          '`/todo view <user|role>` -- View assignments of the specified target.\n' +
          '`/todo list [page number]` -- List assignments assigned to you.\n' +
          '`/todo <task ID> <progress code>` -- Update an assignment\'s progress using the progress codes.\n' +
          '`/todo codes` -- View a list of the progress codes and their meaning.\n' +
          '`/todo <task ID> <note text>` -- Add a note to an assignment\'s progress.');
          break;
        default: channel.send(':warning: | Unknown command.');
      }
      break;
    case 'todo':
      if (!args.length) {
        return channel.send(`:warning: | You must specify a subcommand.`);
      }

      switch (args[0]) {
        case 'assign':
        case 'new':
          if (message.member === null) {
            return channel.send(':warning: | You may only run this command in the server.');
          }

          if (!message.guild.roles.get(adminRole)) {
            return channel.send(":warning: | Sorry, you can't do that!");
          }

          if (args.length < 2) {
            return channel.send(':warning: | You must specify a target.');
          }

          var target = findTarget(message, args);
          if (target === null) {
            return channel.send(":warning: | You must specify a valid target.");
          }

          channel.send("Enter the task name.");
          commandData = {
            id: userId,
            type: 'todo.new.title',
            target: target
          };

          setTimeout(function() {
            if (commandData == null || commandData.type === 'todo.new.desc') return;
            commandData = null;
            channel.send("Command exited.");
          }, n * 1000);
          break;
        case 'list':
          var offset = 1;
          if (args.length > 1) {
            offset = parseInt(args[1]);
            if (!Number.isInteger(offset)) {
              return channel.send(`:warning: | Unknown value: ${args[1]}. You must specify a numeric page number.`);
            }
          }

          displayTask(userId, channel, offset, 'self');
          break;
        case 'view':
          if (message.member === null) {
            return channel.send(':warning: | You may only run this command in the server.');
          }

          if (!message.member.roles.find(r => r.id === adminRole)) {
            return channel.send(":warning: | Sorry, you can't do that!");
          }

          if (args.length < 2) {
            return channel.send(':warning: | You must specify a user.');
          }

          var target = findTarget(message, args);
          if (target === null) {
            return channel.send(":warning: | You must specify a valid target.");
          }

          var offset = 1;
          if (args.length > 2) {
            offset = parseInt(args[2]);
            if (!Number.isInteger(offset)) {
              return channel.send(':warning: | The page number must be numeric.');
            }
          }

          displayTask(target.id, channel, offset, target.username);
          break;
        case 'codes':
          var msg = '```md\n';
          for (var i=0; i < codes.length; i++) {
            msg += `${i}. ${codes[i]}\n`;
          }
          msg += '```';
          channel.send(msg);
          break;
        // case 'delete':
        //   if (message.member === null) {
        //     return channel.send(':warning: | You may only run this command in the server.');
        //   }

        //   if (!message.member.roles.find(r => r.id === adminRole)) {
        //     return channel.send(':warning: | Sorry, you can\'t do that!');
        //   }

        //   if (args.length < 2) {
        //     return channel.send(':warning: | You must specify a target.');
        //   }

        //   var target = findTarget(message, args);
        //   if (target === null) {
        //     return channel.send(":warning: | You must specify a valid target.");
        //   }

        //   var name = target instanceof Discord.User ? target.username : target.name;

        //   var taskId = parseInt(args[3]);
        //   if (!Number.isInteger(taskId)) {
        //     return channel.send(':warning: | Task id must be numeric.');
        //   } else {
        //     var targetId = target.id;
        //     if (target instanceof Discord.Role) {
        //       targetId = target.members.first().id;
        //     }

        //     var count = await todo.get(`${targetId}:tasksCount`);
        //     if (count === undefined) {
        //       return channel.send(`:warning: | There are no tasks assigned to ${name}.`);
        //     }
        //     if (taskId < count || taskId > count) {
        //       return channel.send(':warning: | Incorrect task id specified.');
        //     }
        //   }

        //   if (target instanceof Discord.Role) {
        //     role.members.forEach(async member => {
        //       let userId = member.id;
        //       await todo.delete(`${userId}:${taskId}:title`);
        //       await todo.delete(`${userId}:${taskId}:description`);
        //       await todo.delete(`${userId}:${taskId}:appointedBy`);
        //       await todo.delete(`${userId}:${taskId}:appointedAt`);
        //       await todo.delete(`${userId}:${taskId}:progressCode`);
        //       await todo.delete(`${userId}:${taskId}:progressNote`);
        //       var taskCount = await todo.get(`${userId}:tasksCount`);
        //       if (taskCount == 1) {
        //         await todo.delete(`${userId}:tasksCount`);
        //       } else {
        //         await todo.set(`${userId}:tasksCount`, --taskCount);
        //       }
        //     });
        //   } else {
        //     await todo.delete(`${targetId}:${taskId}:title`);
        //     await todo.delete(`${targetId}:${taskId}:description`);
        //     await todo.delete(`${targetId}:${taskId}:appointedBy`);
        //     await todo.delete(`${targetId}:${taskId}:appointedAt`);
        //     await todo.delete(`${targetId}:${taskId}:progressCode`);
        //     await todo.delete(`${targetId}:${taskId}:progressNote`);
        //     var taskCount = await todo.get(`${targetId}:tasksCount`);
        //     if (taskCount == 1) {
        //       await todo.delete(`${targetId}:tasksCount`);
        //     } else {
        //       await todo.set(`${targetId}:tasksCount`, --taskCount);
        //     }
        //   }
        //   channel.send('Task deleted.');
        //   break;
        default:
          if (args.length > 1) {
            var taskId = parseInt(args[0]);
            if (!Number.isInteger(taskId)) {
              return channel.send(':warning: | Task id must be numeric.');
            } else {
              var result = undefined;
              getTasksCount(userId, count => {
                if (count === undefined) {
                  result = null
                }
              });
              if (result === null) {
                return channel.send(':warning: | You have no assignments.');
              }
              if (taskId < count || taskId > count) {
                return channel.send(':warning: | Incorrect task id specified.');
              }
            }
            
            var code = args[1];
            if (args.length > 2) {
              args.shift();
              todo.run('UPDATE tasks SET note=? WHERE user=? AND id=?', [args.join(' '), userId, taskId]);
              return channel.send(':white_check_mark: Note set.');
            }

            var progressCode = parseInt(code);
            if (!Number.isInteger(progressCode) || progressCode < 0 || progressCode >= codes.length) {
              return channel.send(':warning: | Incorrect code specified. Do `/todo codes` for a list of codes.');
            }

            if (progressCode === codes.length - 1
              || progressCode === codes.length - 2) {
              const embed = new Discord.RichEmbed()
              .setColor('#f44242')
              .setTitle(`${message.author.username} has completed an assignment.`)
              .setDescription(todo.run('SELECT title FROM tasks WHERE user=? AND id=?', [userId, taskId]).rows[0].title)

              client.channels.get(todoChannel).send(embed);

              todo.run('DELETE FROM tasks WHERE user=? AND id=?', [userId, taskId]);
            } else {
              todo.run('UPDATE tasks SET progress=? WHERE user=? AND id=?', [progressCode, userId, taskId]);
            }
            
            return channel.send(`:white_check_mark: Set assignment #${taskId} to \`${codes[progressCode]}\`.`);
          } else {
            return channel.send(':warning: | Incorrect arguments.');
          }
      }
      break;
  }
});

function findTarget(message, args) {
  var target = message.mentions.users.first();
  if (target == null) {
    target = client.users.find(user => user.username.toLowerCase().startsWith(args[1]));
    if (target == null) {
      args.shift();
      target = message.guild.roles.find(role => role.name.toLowerCase().startsWith(args.join(' ')));
      if (target == null) {
        return null;
      }
    }
  }
  return target;
}

function findUser(message, name) {
  var target = message.mentions.users.first();
  if (target == null) {
    target = client.users.find(user => user.username.toLowerCase().startsWith(name));
    return target;
  }
  return target;
}

function assignTask(target, id, title, description, appointedBy) {
  var date = new Date();
  todo.run(`INSERT INTO tasks (user, id, title, description, appointedBy, date) VALUES (?, ?, ?, ?, ?, ?)`, [target, id, title, description, appointedBy, (date.toLocaleString('en-us', { month: 'long' }) + ' ' + date.getDay())]);
}

function displayTask(userId, channel, offset, who) {
  getTasksCount(userId, count => {
    if (count === undefined) {
      const embed = new Discord.RichEmbed()
      .setColor('#f44242')
      .setDescription((who === 'self' ? 'You have' : who + ' has') +  ' no assigned tasks at the moment.')
      return channel.send(embed);
    }
  
    if (offset > count || offset < 1) {
      return channel.send(':warning: | Invalid page number.');
    }
  
    const embed = new Discord.RichEmbed()
      .setColor('#f44242')
      .setAuthor((who === 'self' ? 'Your' : who + '\'s') + ' TO-DO')
      .setDescription(`#${offset} (of ${count} total)`)
  
    getTask(userId, offset, task => {
      console.log(task);
      embed.addField(task.title, task.description)
        .addField(`Assigned by ${task.appointedBy}`, `On ${task.date}`, true)
        .addField(`Progress`, codes[task.progress], true);
    
      if (task.note != null) {
        embed.addField('Note', task.note, true);
      }
    
      if (who === 'self') {
        embed.setFooter('Use \`/todo <task id> <progress code>\` to update a task\'s progress.');
      }
    
      channel.send(embed);
    });
  });
}

function getTasksCount(target, callback) {
  todo.all('SELECT COUNT(*) AS tasksCount FROM tasks WHERE user=?', [target], (err, rows) => {
    if (err) throw err;

    if (rows !== undefined) {
      callback(rows[0].tasksCount);
    }
  });
}

function getTask(target, id, callback) {
  todo.run('SELECT title, description, appointedBy, date, progress, note FROM tasks WHERE user=? AND id=?', [target, id], (err, rows, fields) => {
    if (err) throw err;

    if (rows !== undefined) {
      console.log(rows);
      callback(rows[0]);
    }
  });
}

client.login(token);