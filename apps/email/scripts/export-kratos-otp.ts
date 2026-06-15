import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { renderOTPTemplate } from '../emails/otp-template'

type KratosOTPScenario = {
  name: 'login_code' | 'registration_code'
  codePlaceholder: string
  purpose: string
  subject: string
}

const scenarios: KratosOTPScenario[] = [
  {
    name: 'login_code',
    codePlaceholder: '{{ .LoginCode }}',
    purpose: 'vous connecter',
    subject: 'Votre code de connexion',
  },
  {
    name: 'registration_code',
    codePlaceholder: '{{ .RegistrationCode }}',
    purpose: 'finaliser votre inscription',
    subject: "Votre code d'inscription",
  },
]

async function main() {
  const appRoot = path.resolve(import.meta.dir, '..')
  const repoRoot = path.resolve(appRoot, '..', '..')
  const kratosRoot = path.join(repoRoot, 'deployments', 'kratos', 'courier')
  const renderToken = '__KRATOS_OTP_CODE__'

  for (const scenario of scenarios) {
    const rendered = await renderOTPTemplate({
      code: renderToken,
      purpose: scenario.purpose,
      locale: 'fr',
    })

    const targetDir = path.join(kratosRoot, scenario.name, 'valid')
    await mkdir(targetDir, { recursive: true })

    const html = rendered.html.replaceAll(renderToken, scenario.codePlaceholder)
    const text = rendered.text.replaceAll(renderToken, scenario.codePlaceholder)

    await writeFile(path.join(targetDir, 'email.subject.gotmpl'), `${scenario.subject}\n`)
    await writeFile(path.join(targetDir, 'email.body.gotmpl'), html)
    await writeFile(path.join(targetDir, 'email.body.plaintext.gotmpl'), `${text}\n`)
  }
}

await main()
