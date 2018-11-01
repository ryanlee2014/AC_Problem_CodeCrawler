const superagent = require("superagent");
require("superagent-charset")(superagent);
const cheerio = require("cheerio");
const config = require("./config.json");
const browser_config = config.browser;
const agent = superagent.agent;
const readline = require("readline");
const fs = require("fs");
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function WriteFile(context,name) {
    fs.writeFile("./hdu/" + name,context,(err,res) => {
        console.log(`${name} finished`);
    })
}

function parseLanguage(language) {
    const lang = {
        "G++":"cpp",
        "GCC":"c",
        "C++":"cpp",
        "C":"c",
        "Pascal":"pas",
        "Java":"java",
        "C#":"cs"
    };
    return lang[language] || "cpp";
}

function hduAccountMaker(user_id, password) {
    return {
        "username": user_id,
        "userpass": password
    }
}

const hduAgent = agent();

async function getUserAndPass() {
    let user_id,password;
    user_id = password = "";
    await new Promise((resolve, reject) => {
        rl.question("UserID:", (answer => {
            resolve(answer);
        }));
    })
        .then(resolve => {
            user_id = resolve;

        })
        .catch(reject => {
            console.log(reject);
            process.exit(1);
        });

    await new Promise((resolve, reject) => {
        rl.question("Password:", (answer => {
            resolve(answer);
        }))
    })
        .then(resolve => {
            password = resolve;
        })
        .catch(reject => {
            console.log(reject);
            process.exit(1);
        });
    return [user_id,password];
}

function validConfigUserAccount() {
    return config.hdu.username && config.hdu.username.length > 1 && config.hdu.userpass && config.hdu.userpass.length >= 6;
}

async function main(argc, argv) {
    console.log("Source code crawler for HDU");
    let user_id,password;
    if(!validConfigUserAccount()) {
        [user_id,password] = getUserAndPass();
    }
    else {
        user_id = config.hdu.username;
        password = config.hdu.userpass;
    }
    await new Promise((resolve, reject) => {
        hduAgent.post("http://acm.hdu.edu.cn/userloginex.php?action=login")
            .set(browser_config)
            .send(hduAccountMaker(user_id,password))
            .end((err, response) => {
                //console.log(response.headers);
                if (response.headers["set-cookie"] && response.headers["set-cookie"].length > 0)
                    hduAgent._saveCookies(response);
                resolve();
            });
    });

    hduAgent
        .get("http://acm.hdu.edu.cn")
        .set(browser_config)
        .end((err,response) => {
            if(err || response.text.indexOf("Sign Out") === -1) {
                console.error("ERROR:Login Failed");
                process.exit(1);
            }
        });

    let arr = [];

    await new Promise((resolve,reject) => {
        function collect(run_id) {
            hduAgent.get(`http://acm.hdu.edu.cn/status.php?${run_id?`first=${run_id}&`:``}user=RyanLeeCUP&status=5`)
                .set(browser_config)
                .end((err,response) => {
                    const $ = cheerio.load(response.text);
                    const table = $(".table_text").find('tr');
                    let len = table.length;
                    for(let i = 1;i<len;++i) {
                        arr.push({
                            problem_id:table.eq(i).find("td").eq(3).text(),
                            run_id:table.eq(i).find("td").eq(0).text(),
                            language:parseLanguage(table.eq(i).find("td").eq(7).text())
                        })
                    }

                    if(len <= 1) {
                        resolve();
                    }
                    else {
                        collect(parseInt(table.eq(len - 1).find("td").eq(0).text()) - 1);
                    }
                })
        }
        collect();
    });
    fs.mkdir("./hdu",(err) => {});
    let delay = 0;

    arr.forEach((element) => {
        setTimeout(function(){
            hduAgent
                .get("http://acm.hdu.edu.cn/viewcode.php?rid=" + element.run_id)
                .set(browser_config)
                .charset('gbk')
                .end((err,response) => {
                    const $ = cheerio.load(response.text);
                    const code = $("#usercode").val();
                    const fileName = `${element.problem_id}-${element.run_id}.${element.language}`;
                    WriteFile(code,fileName);
                })
        },delay++ * 20);
    });
    console.log(`Your source code file are in ${process.cwd()}/hdu`);
    console.log(`Process exit.`);
    process.exit(0);
}

main();
