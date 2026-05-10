import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { collectDomFormValues, resetDomFormValues, restoreDomFormValues } from '../src/domControls'

class FakeBaseControl {
    public name = ''
    public tagName = ''
    private ignored = false

    public constructor(tagName: string, name: string, ignored = false) {
        this.tagName = tagName
        this.name = name
        this.ignored = ignored
    }

    public matches(): boolean {
        return this.ignored
    }

    public closest(): FakeBaseControl | null {
        return this.ignored ? this : null
    }
}

class FakeInput extends FakeBaseControl {
    public type: string
    public value: string
    public checked: boolean
    public defaultValue: string
    public defaultChecked: boolean

    public constructor(
        name: string,
        type = 'text',
        value = '',
        checked = false,
        defaultValue = value,
        defaultChecked = checked,
        ignored = false
    ) {
        super('INPUT', name, ignored)
        this.type = type
        this.value = value
        this.checked = checked
        this.defaultValue = defaultValue
        this.defaultChecked = defaultChecked
    }
}

class FakeTextArea extends FakeBaseControl {
    public value: string
    public defaultValue: string

    public constructor(name: string, value = '', defaultValue = value) {
        super('TEXTAREA', name)
        this.value = value
        this.defaultValue = defaultValue
    }
}

class FakeOption {
    public value: string
    public selected: boolean
    public defaultSelected: boolean

    public constructor(value: string, selected = false, defaultSelected = selected) {
        this.value = value
        this.selected = selected
        this.defaultSelected = defaultSelected
    }
}

class FakeSelect extends FakeBaseControl {
    public multiple: boolean
    public options: FakeOption[]

    public constructor(name: string, options: FakeOption[], multiple = false) {
        super('SELECT', name)
        this.options = options
        this.multiple = multiple
    }

    public get value(): string {
        const selected = this.options.find((option) => option.selected)
        return selected ? selected.value : ''
    }

    public set value(value: string) {
        let hasMatch = false
        for (let i = 0; i < this.options.length; ++i) {
            const option = this.options[i]
            option.selected = option.value === value
            hasMatch = hasMatch || option.selected
        }

        if (!hasMatch) {
            for (let i = 0; i < this.options.length; ++i) {
                this.options[i].selected = false
            }
        }
    }
}

class FakeRoot {
    private controls: FakeBaseControl[]

    public constructor(controls: FakeBaseControl[]) {
        this.controls = controls
    }

    public querySelectorAll(): FakeBaseControl[] {
        return this.controls
    }
}

class FakeForm extends FakeRoot {
    public reset = vi.fn()
}

beforeEach(() => {
    vi.stubGlobal('HTMLInputElement', FakeInput)
    vi.stubGlobal('HTMLTextAreaElement', FakeTextArea)
    vi.stubGlobal('HTMLSelectElement', FakeSelect)
    vi.stubGlobal('HTMLFormElement', FakeForm)
})

afterEach(() => {
    vi.unstubAllGlobals()
})

describe('DOM control helpers', () => {
    it('collects values from native named controls', () => {
        const root = new FakeRoot([
            new FakeInput('title', 'text', 'Hello'),
            new FakeTextArea('notes', 'Long text'),
            new FakeInput('enabled', 'checkbox', 'on', true),
            new FakeInput('features', 'checkbox', 'ocr', true),
            new FakeInput('features', 'checkbox', 'llm', false),
            new FakeInput('mode', 'radio', 'fast', false),
            new FakeInput('mode', 'radio', 'accurate', true),
            new FakeSelect(
                'language',
                [new FakeOption('en', false), new FakeOption('ru', true)],
                false
            ),
            new FakeSelect(
                'tags',
                [new FakeOption('a', true), new FakeOption('b', false), new FakeOption('c', true)],
                true
            ),
            new FakeInput('upload', 'file', 'ignored'),
            new FakeInput('secret', 'password', 'ignored'),
            new FakeInput('ignored', 'text', 'ignored', false, 'ignored', false, true)
        ])

        expect(collectDomFormValues(root as unknown as ParentNode)).toEqual({
            title: 'Hello',
            notes: 'Long text',
            enabled: true,
            features: ['ocr'],
            mode: 'accurate',
            language: 'ru',
            tags: ['a', 'c']
        })
    })

    it('can include password fields when explicitly requested', () => {
        const root = new FakeRoot([new FakeInput('secret', 'password', 'saved')])

        expect(
            collectDomFormValues(root as unknown as ParentNode, { includePasswords: true })
        ).toEqual({
            secret: 'saved'
        })
    })

    it('ignores nameless controls even with a broad custom selector', () => {
        const root = new FakeRoot([
            new FakeInput('', 'text', 'ignored'),
            new FakeInput('title', 'text', 'Saved')
        ])

        expect(
            collectDomFormValues(root as unknown as ParentNode, { controlSelector: 'input' })
        ).toEqual({
            title: 'Saved'
        })
    })

    it('handles control names that match Object prototype keys', () => {
        const root = new FakeRoot([
            new FakeInput('constructor', 'checkbox', 'a', true),
            new FakeInput('constructor', 'checkbox', 'b', false),
            new FakeInput('toString', 'radio', 'yes', false)
        ])

        expect(collectDomFormValues(root as unknown as ParentNode)).toEqual({
            constructor: ['a'],
            toString: null
        })
    })

    it('restores values into native controls', () => {
        const title = new FakeInput('title', 'text')
        const notes = new FakeTextArea('notes')
        const enabled = new FakeInput('enabled', 'checkbox')
        const featuresOcr = new FakeInput('features', 'checkbox', 'ocr')
        const featuresLlm = new FakeInput('features', 'checkbox', 'llm')
        const fast = new FakeInput('mode', 'radio', 'fast')
        const accurate = new FakeInput('mode', 'radio', 'accurate')
        const language = new FakeSelect('language', [new FakeOption('en'), new FakeOption('ru')])
        const tags = new FakeSelect(
            'tags',
            [new FakeOption('a'), new FakeOption('b'), new FakeOption('c')],
            true
        )
        const root = new FakeRoot([
            title,
            notes,
            enabled,
            featuresOcr,
            featuresLlm,
            fast,
            accurate,
            language,
            tags
        ])

        restoreDomFormValues(root as unknown as ParentNode, {
            title: 'Restored',
            notes: 'Restored notes',
            enabled: true,
            features: ['llm'],
            mode: 'fast',
            language: 'ru',
            tags: ['a', 'c']
        })

        expect(title.value).toBe('Restored')
        expect(notes.value).toBe('Restored notes')
        expect(enabled.checked).toBe(true)
        expect(featuresOcr.checked).toBe(false)
        expect(featuresLlm.checked).toBe(true)
        expect(fast.checked).toBe(true)
        expect(accurate.checked).toBe(false)
        expect(language.value).toBe('ru')
        expect(tags.options.map((option) => option.selected)).toEqual([true, false, true])
    })

    it('resets controls to their native defaults inside a non-form root', () => {
        const title = new FakeInput('title', 'text', 'Changed', false, 'Default')
        const enabled = new FakeInput('enabled', 'checkbox', 'on', false, 'on', true)
        const language = new FakeSelect('language', [
            new FakeOption('en', false, true),
            new FakeOption('ru', true)
        ])
        const root = new FakeRoot([title, enabled, language])

        resetDomFormValues(root as unknown as HTMLElement)

        expect(title.value).toBe('Default')
        expect(enabled.checked).toBe(true)
        expect(language.value).toBe('en')
    })

    it('delegates reset to native form.reset when the root is a form', () => {
        const form = new FakeForm([])

        resetDomFormValues(form as unknown as HTMLElement)

        expect(form.reset).toHaveBeenCalledOnce()
    })
})
