#!/usr/bin/env node

const fs = require("fs-extra");
const path = require("path");
const { program } = require("commander");
const inquirer = require("inquirer");
const chalk = require("chalk");
const execSync = require("child_process").execSync;

const pkg = require("./package.json");
const templatePath = path.resolve(__dirname, "./templates");
const templateDirs = fs.readdirSync(templatePath);
const templateProjectMap = Object.create(null);

console.log();
console.log(chalk.green("kris-cli(version:" + pkg.version + ")"));
console.log();

// 模板排序
const projectInfo = templateDirs
    .map((dir) => {
        const info = {
            name: dir,
            description: "",
            sort: 9999,
            repository: "",
        };
        const dirPkg = `${templatePath}/${dir}/package.json`;

        if (fs.existsSync(dirPkg)) {
            const pkg = require(dirPkg);
            if (pkg.project) {
                info.description = pkg.project.description;
                info.sort = pkg.project.sort;
                info.repository = pkg.project.repository;
            }
        }

        templateProjectMap[dir] = info;
        return info;
    })
    .sort((a, b) => a.sort - b.sort);

program
    .command("create [projectName]")
    .option("-t, --template [template]", "配置一个模板")
    .description("创建一个模板项目")
    .action(async (projectName, options) => {
        let targetDir = projectName;
        let targetTemplate = options.template;

        if (!targetDir) {
            const { name } = await inquirer.prompt({
                type: "input",
                name: "name",
                message: `请输入项目名称`,
                initial: "project-template",
            });
            targetDir = name;
        }

        if (!targetTemplate) {
            const { template } = await inquirer.prompt({
                name: "template",
                type: "list",
                message: "请选择项目模板：",
                pageSize: 20,
                default: "react-app",
                choices: projectInfo.map((info) => {
                    return {
                        value: info.name,
                        short: info.name,
                        name: [
                            `名称：${info.name}`,
                            `  描述：${info.description || "无"}`,
                        ].join("\n"),
                    };
                }),
            });
            targetTemplate = template;
        }

        if (fs.existsSync(targetDir)) {
            console.log(chalk.red("创建失败，项目已存在！"));
            process.exit(1);
        }

        const templateRoot = templatePath + "/" + targetTemplate;
        const files = fs.readdirSync(templateRoot);
        const repository = templateProjectMap[targetTemplate]["repository"];

        // 复制远程模板
        if (repository) {
            // 清空文件夹
            fs.emptyDir(targetDir);
            console.log("请稍后，项目模板复制中...");
            execSync(`git clone ${repository} ${targetDir}`);
            fs.removeSync(`${targetDir}/.git`);
        } else {
            files.forEach((file) => {
                if (file.indexOf("dist") > -1 || file === "node_modules")
                    return;
                fs.copySync(`${templateRoot}/${file}`, `${targetDir}/${file}`);
            });

            const pkgPath = `${process.cwd()}/${targetDir}/package.json`;
            if (fs.existsSync(pkgPath)) {
                const pkg = require(pkgPath);
                pkg.name = targetDir;
                fs.writeFileSync(
                    `${targetDir}/package.json`,
                    JSON.stringify(pkg, null, 2)
                );
            }
        }
        console.log();
        console.log(chalk.green("项目初始化完成"));
        console.log();
        console.log(
            `请进入 ${chalk.green(targetDir)} 项目，执行 ${chalk.green(
                "npm install"
            )} 安装项目依赖...`
        );
    });

// 处理命令行输入的参数
program.parse(process.argv);
