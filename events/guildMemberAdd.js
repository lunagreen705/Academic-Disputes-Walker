const colors = require('../UI/colors/colors');


module.exports = async (client, member) => {


    const welcomeChannelId = '1519372330281992433';



    // ==========================
    // MBTI互斥身份組
    // emoji ID : role ID
    // ==========================

    const mbtiRoles = {


        "1519370547417452715": "1519378264517247147",

        "1520444740561010918": "1519378334092492820",

        "1519370524248248481": "1519378461406396537",

        "1519370516161368186": "1519378525357084783"


    };




    // ==========================
    // 顯示用自訂表情
    // ==========================


    const emojis = {


        NT:
        "<:rbmd:1519370547417452715>",


        SJ:
        "<:rbno:1520444740561010918>",


        SP:
        "<:rbgp:1519370524248248481>",


        NF:
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






        const welcomeMessage =

`歡迎來到基地，${member.user.tag}！
這裡供應美國水壺玉米屋 🌽
請選擇你的身份組：

${emojis.NT} 紫人
${emojis.SJ} 藍人
${emojis.SP} 黃人
${emojis.NF} 綠人

點擊新的身份組會自動替換舊身份組`;






        const message =
            await welcomeChannel.send(
                welcomeMessage
            );






        // 加入表情

        for(
            const emojiID of Object.keys(mbtiRoles)
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

            `${colors.cyan}[WELCOME]${colors.reset} `+
            `${colors.green}${member.user.tag} 歡迎訊息完成${colors.reset}`

        );









        const collector =
            message.createReactionCollector({


                filter:(reaction,user)=>{


                    return (

                        mbtiRoles[
                            reaction.emoji.id
                        ]

                        &&

                        !user.bot

                    );


                }


            });









        // ==========================
        // 點擊表情
        // ==========================


        collector.on(
            'collect',
            async(reaction,user)=>{


                try{


                    const newRoleID =
                        mbtiRoles[
                            reaction.emoji.id
                        ];



                    const role =
                        member.guild.roles.cache.get(
                            newRoleID
                        );


                    if(!role)
                        return;




                    const targetMember =
                        await member.guild.members.fetch(
                            user.id
                        );







                    // ==========================
                    // 移除其他MBTI身份
                    // ==========================


                    for(
                        const oldRoleID of Object.values(mbtiRoles)
                    ){


                        if(
                            oldRoleID !== newRoleID
                            &&
                            targetMember.roles.cache.has(oldRoleID)
                        ){


                            await targetMember.roles.remove(
                                oldRoleID
                            );


                            console.log(
                                `[MBTI REMOVE] ${user.tag} - ${oldRoleID}`
                            );


                        }


                    }








                    // ==========================
                    // 加入新的
                    // ==========================


                    if(
                        !targetMember.roles.cache.has(newRoleID)
                    ){


                        await targetMember.roles.add(
                            newRoleID
                        );


                        console.log(
                            `[MBTI ADD] ${user.tag} + ${role.name}`
                        );


                    }



                }
                catch(err){

                    console.error(err);

                }


            }

        );












        // ==========================
        // 移除表情
        // ==========================


        collector.on(
            'remove',
            async(reaction,user)=>{


                try{


                    if(user.bot)
                        return;



                    const roleID =
                        mbtiRoles[
                            reaction.emoji.id
                        ];



                    if(!roleID)
                        return;





                    const targetMember =
                        await member.guild.members.fetch(
                            user.id
                        );






                    if(
                        targetMember.roles.cache.has(roleID)
                    ){


                        await targetMember.roles.remove(
                            roleID
                        );


                        console.log(
                            `[MBTI REMOVE] ${user.tag} - ${roleID}`
                        );


                    }




                }
                catch(err){

                    console.error(err);

                }


            }

        );








    }
    catch(error){


        console.error(

            `${colors.red}[WELCOME ERROR]${colors.reset}`,

            error

        );


    }


};