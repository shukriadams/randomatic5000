const fs = require('fs-extra'),
    yaml = require('js-yaml'),
    sample = require('lodash.sample'),
    Chance = require('chance'),
    chance = new Chance()

function parseTemplate(template){
    const parsed = {
        parts : []
    }
    if (!typeof template === 'string')
        throw `template ${template} should be a string`

    const parts = template.split(' ')
    for (const part of parts){

        let partclean = part.trim(),
            match = partclean.match(/^{(.*)}$/)
        if (match){
            parsed.parts.push({
                isToken : true,
                part,
                token : match.pop()
            })
        } else {
            parsed.parts.push({
                isToken : false,
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
                if (!part.isToken)
                    continue

                if (!this.settings.sets[part.token])
                    throw `template "${templateRaw}" requires a set "${part.token}" that is not defined`
            }

            _parsedTemplates.push(parsedTemplate)
        }


        console.log(this.settings)
    }

    next(){
        const template = sample(_parsedTemplates)
        console.log(template)

        let output = ''
        for (const part of template.parts){
            if (part.isToken){
                const set = this.settings.sets[part.token]
                output += part.part.replace(`{${part.token}}`, sample(set))
            } else
                output += part.part

            output = `${output} `
        }

        return output.trim()
    }
}