const colors = require('../UI/colors/colors');


module.exports = async (client, member) => {


    const welcomeChannelId = '1519372330281992433';



    // ==========================
    // 自訂表情 + 身份組設定
    // ==========================

    const roles = {


        // emojiID : roleID

        "1519370547417452715": "1519378264517247147",

        "1520444740561010918": "1519378334092492820",

        "1519370524248248481": "1519378461406396537",

        "1519370516161368186": "1519378525357084783"


    };



    // 顯示在訊息上的自訂表情

    const emojis = {


        "NT":
        "<:rbmd:1519370547417452715>",


        "SJ":
        "<:rbno:1520444740561010918>",


        "SP":
        "<:rbgp:1519370524248248481>",


        "NF":
        "<:rbmt:1519370516161368186>"


    };




    try {



        const welcomeChannel =
            member.guild.channels.cache.get(
                welcomeChannelId
            );



        if(!welcomeChannel){


            console.log(
                `${colors.red}[WELCOME] 找不到頻道${colors.reset}`
            );


            return;

        }






        // ==========================
        // 歡迎訊息
        // ==========================


        const welcomeMessage =

`歡迎來到基地，${member.user.tag}！
這裡供應美國水壺玉米屋 🌽


請選擇你的身份組：


${emojis["NT"]} 紫人

${emojis["SJ"]} 藍人

${emojis["SP"]} 黃人

${emojis["NF"]} 綠人



再次點擊同一表情可以取消身份組`;




        const message =
            await welcomeChannel.send(
                welcomeMessage
            );






        // ==========================
        // 添加自訂表情
        // ==========================


        for(
            const emojiID of Object.keys(roles)
        ){


            const emoji =
                member.guild.emojis.cache.get(
                    emojiID
                );


            if(emoji){

                await message.react(emoji);

            }


        }







        console.log(

            `${colors.cyan}[ WELCOME ]${colors.reset} `+
            `${colors.green}${member.user.tag} 歡迎訊息完成${colors.reset}`

        );









        // ==========================
        // 點擊事件
        // ==========================


        const collector =
            message.createReactionCollector({



                filter:(reaction,user)=>{


                    return (

                        roles[
                            reaction.emoji.id
                        ]

                        &&

                        !user.bot

                    );


                }



            });








        collector.on(
            'collect',
            async(reaction,user)=>{


                try{



                    const roleID =
                        roles[
                            reaction.emoji.id
                        ];



                    const role =
                        member.guild.roles.cache.get(
                            roleID
                        );



                    if(!role)
                        return;






                    const targetMember =
                        await member.guild.members.fetch(
                            user.id
                        );








                    // 已有身份組 -> 移除

                    if(
                        targetMember.roles.cache.has(roleID)
                    ){


                        await targetMember.roles.remove(
                            role
                        );



                        console.log(
                            `[ROLE REMOVE] ${user.tag} - ${role.name}`
                        );


                    }





                    // 沒有 -> 增加

                    else{


                        await targetMember.roles.add(
                            role
                        );



                        console.log(
                            `[ROLE ADD] ${user.tag} + ${role.name}`
                        );


                    }





                }catch(err){


                    console.error(err);


                }


            }

        );





    }catch(error){


        console.error(

            `${colors.red}[WELCOME ERROR]${colors.reset}`,

            error

        );


    }


};