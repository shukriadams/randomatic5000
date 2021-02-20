const fs = require('fs-extra'),
    yaml = require('js-yaml'),
    sample = require('lodash.sample'),
    Chance = require('chance'),
    util = require('util'),
    chance = new Chance()

function parseTemplate(template){
    const parsed = {
        raw: template,
        parts : []
    }

    if (!typeof template === 'string')
        throw `template ${template} should be a string`

    const parts = template.split(' ')
    for (const part of parts){
        const match = part.match(/{(.*)}/)

        if (match){
            const rawToken = match.pop()
            parsed.parts.push({
                part,
                rawToken,
                tokens : rawToken.split('|')
            })
        } else {
            parsed.parts.push({
                part
            })
        }
    }
    return parsed
}

const _parsedTemplates = []


module.exports = class {
    constructor(options){
        if (!options.settings)
            throw `Expecting options.settings file path property`

        if (!fs.existsSync(options.settings))
            throw `Settings yml file not found at path ${options.settings}`

        let incomingSettings = null,
            defaultSettings = {
                templates : [],
                sets : {}
            }
        
        try {
            const settingsYML = fs.readFileSync(options.settings, 'utf8')
            incomingSettings = yaml.safeLoad(settingsYML)
        } catch (e) {
            throw `Error try to load ${options.settings} : ${e}`
        }    
        
        this.settings = Object.assign(defaultSettings, incomingSettings)

        // standardize settings
        for (const setName in this.settings.sets){
            let set = this.settings.sets[setName]
            // sets can be defined as comma-separated strings, but are expected to be arrays
            if (typeof set === `string`)
                this.settings.sets[setName] = set.split(',')
        }
        
        // clean up incoming data
        for (const setName in this.settings.sets){
            // remove spaces
            this.settings.sets[setName] = this.settings.sets[setName].map(r => r.trim())
        }



        // validate settings
        if (!Array.isArray(this.settings.templates))
            throw '"templates" in settings file should be string array'

        if (this.settings.templates.length === 0)
            throw `No templates defined, please add at least one`

        // sets cannot be empty
        for (const setName in this.settings.sets)
            if (!this.settings.sets[setName].length)
                throw `Set ${setName} is empty`

        // ensure that sets defined in templates exist
        for (const templateRaw of this.settings.templates){
            const parsedTemplate = parseTemplate(templateRaw)
            for (let part of parsedTemplate.parts){
                if (!part.tokens)
                    continue

                for (const token of part.tokens)
                    if (!this.settings.sets[token])
                        throw `template "${templateRaw}" requires a set "${token}" that is not defined`
            }

            _parsedTemplates.push(parsedTemplate)
        }
    }

    next(){
        const template = sample(_parsedTemplates)
        
        // console.log(util.inspect(_parsedTemplates, { showHidden: false, depth: null }))

        let output = ''
        for (const part of template.parts){

            if (part.tokens){
                const set = this.settings.sets[sample(part.tokens)]
                output += part.part.replace(`{${part.rawToken}}`, sample(set))  
            } else
                output += part.part

            output = `${output} `
        }

        return { 
            template : template.raw,
            result : output.trim()
        }
    }
}