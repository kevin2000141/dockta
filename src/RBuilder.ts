import Builder from './Builder'

export default class RBuilder extends Builder {

  readonly date: string

  constructor (pat: string) {
    super(pat)

    let date
    if (this.exists('DESCRIPTION')) {
      const desc = this.read('DESCRIPTION')
      const match = desc.match(/Date:\ *(.+)/)
      if (match) {
        date = Date.parse(match[1])
        if (isNaN(date)) {
          throw new Error('Unable to parse date in DESCRIPTION file: ' + match[1])
        } else {
          date = new Date(date)
        }
      }
    }

    if (!date) date = new Date(Date.now() - 24 * 3600 * 1000)

    this.date = date.toISOString().substring(0,10)
  }

  matchPaths (): Array<string> {
    return ['DESCRIPTION', 'cmd.R']
  }

  sysVersion (): number {
    // At time of writing, MRAN did not have an ubuntu:bionic repo which
    // supported R 3.4 (only bionic_3.5)
    // See https://cran.microsoft.com/snapshot/2018-10-05/bin/linux/ubuntu/
    // So require xenial.
    return 16.04
  }

  aptRepos (sysVersion: number): Array<[string, string]> {
    // TODO if no date, then use cran
    // TODO parameterize the date!
    const sysVersionName = this.sysVersionName(sysVersion)
    return [
      [
        `deb https://mran.microsoft.com/snapshot/${this.date}/bin/linux/ubuntu ${sysVersionName}/`,
        '51716619E084DAB9'
      ]
    ]
  }

  aptPackages (sysVersion: number): Array<string> {
    return ['r-base']
  }

  installPackages (sysVersion: number) {
    // If there is an `install.R` file in the path then use that
    // otherwise use special `install.R` which reads from `DESCRIPTION`
    return {
      files: {
        'install.R': 'file.create("foo.txt")',
        'DESCRIPTION': ''
      },
      command: ['Rscript', 'install.R']
    }
  }

  copyFiles (sysVersion: number): Array<string> {
    if (this.exists('cmd.R')) return ['cmd.R']
    else return []
  }

  command (sysVersion: number): string | undefined {
    if (this.exists('cmd.R')) return 'Rscript cmd.R'
  }
}
