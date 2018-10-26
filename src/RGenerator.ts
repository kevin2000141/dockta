import Generator from './Generator'
import { SoftwarePackage } from './context'

/**
 * A Dockerfile generator for R environments
 */
export default class RGenerator extends Generator {

  // Methods that override those in `Generator`.
  // See that class for documentation on what each function does

  appliesRuntime (): string {
    return 'R'
  }

  baseVersion (): string {
    // At time of writing, MRAN did not have an ubuntu:18.04(bionic) repo which supported R 3.4 (only bionic_3.5)
    // See https://cran.microsoft.com/snapshot/2018-10-05/bin/linux/ubuntu/
    // So require ubuntu:16.04(xenial).
    return '16.04'
  }

  envVars (sysVersion: string): Array<[string, string]> {
    return [
      // Set the timezone to avoid warning from Sys.timezone()
      // See https://github.com/rocker-org/rocker-versioned/issues/89
      ['TZ', 'Etc/UTC'],
      // Set the location to install R packages since they will be installed
      // into the image by a non-root user.
      // See https://stat.ethz.ch/R-manual/R-devel/library/base/html/libPaths.html
      ['R_LIBS_USER', '~/R']
    ]
  }

  aptRepos (sysVersion: string): Array<[string, string]> {
    // TODO if no date, then use cran
    const sysVersionName = this.sysVersionName(sysVersion)
    const date = this.environ.datePublished
    return [
      [
        `deb https://mran.microsoft.com/snapshot/${date}/bin/linux/ubuntu ${sysVersionName}/`,
        '51716619E084DAB9'
      ]
    ]
  }

  aptPackages (sysVersion: string): Array<string> {
    // Walk through R packages and find any deb packages
    let debpkgs: Array<string> = []

    function find (pkg: any) {
      if (pkg.runtimePlatform !== 'R' || !pkg.softwareRequirements) return
      for (let subpkg of pkg.softwareRequirements) {
        if (subpkg.runtimePlatform === 'deb') {
          debpkgs.push(subpkg.name || '')
        } else {
          find(subpkg)
        }
      }
    }

    for (let pkg of this.environ.softwareRequirements || []) find(pkg)

    return debpkgs.concat([
      'r-base'
    ])
  }

  installFiles (sysVersion: string): Array<[string, string]> {
    // Copy user defined files if they exist
    if (this.exists('install.R')) return [['install.R', 'install.R']]
    if (this.exists('DESCRIPTION')) return [['DESCRIPTION', 'DESCRIPTION']]

    // Generate a .DESCRIPTION to copy into image
    const pkgs = this.filterPackages('R').map(pkg => pkg.name)
    let desc = `Package: ${this.environ.name}
Version: 1.0.0
Date: ${this.environ.datePublished}
Imports:\n  ${pkgs.join(',\n  ')}
Description: Generated by Dockter ${new Date().toISOString()}.
  To stop Dockter generating this file and start editing it yourself, rename it to "DESCRIPTION".\n`
    this.write('.DESCRIPTION', desc)
    return [['.DESCRIPTION', 'DESCRIPTION']]
  }

  installCommand (sysVersion: string): string | undefined {
    let cmd = 'mkdir ~/R'
    if (this.exists('install.R')) {
      // Run the user supplied installation script
      cmd += ` \\\n && Rscript install.R`
    } else if (this.exists('DESCRIPTION') || this.exists('.DESCRIPTION')) {
      // To keep the Dockerfile as simple as possible, download and
      // execute the installation-from-DESCRIPTION script.
      cmd += ` \\\n && bash -c "Rscript <(curl -sL https://unpkg.com/@stencila/dockter/src/install.R)"`
    }
    return cmd
  }

  /**
   * The files to copy into the Docker image
   *
   * Copies all `*.R` files to the container
   */
  projectFiles (): Array<[string, string]> {
    const rfiles = this.glob('**/*.R')
    return rfiles.map(file => [file, file]) as Array<[string, string]>
  }

  /**
   * The command to execute in a container created from the Docker image
   *
   * If there is a top-level `main.R` or `cmd.R` then that will be used,
   * otherwise, the first `*.R` files by alphabetical order will be used.
   */
  runCommand (): string | undefined {
    const rfiles = this.glob('**/*.R')
    if (rfiles.length === 0) return
    let script
    if (rfiles.includes('main.R')) script = 'main.R'
    else if (rfiles.includes('cmd.R')) script = 'cmd.R'
    else script = rfiles[0]
    return `Rscript ${script}`
  }
}
