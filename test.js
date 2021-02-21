
 let fs = require('fs-extra'),
    yaml = require('js-yaml'),
    settings

try {
    settings = yaml.safeLoad(fs.readFileSync('./example.yml', 'utf8'))
} catch (e) {
    throw `Error try to load settings : ${e}`
}    

const Randomtic = require('./index'),
    tries = 1,
    randomatic = new Randomtic(settings)

for (let i = 0; i < tries ; i ++)
    console.log(randomatic.next())
