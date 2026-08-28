import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { MacosSigner } from "./macos-signer";
import { WindowsSigner } from "./windows-signer";

export interface SignOptions {
  buildPath?: string;
  platform?: string;
  identity?: string;
  entitlementsPath?: string;
  notarize?: boolean;
  certificatePath?: string;
  certificateThumbprint?: string;
  timestampUrl?: string;
  [key: string]: unknown;
}

interface YargsLike {
  option: (name: string, config: Record<string, unknown>) => YargsLike;
}

export class SignCommand {
  public readonly name = "Sign build";

  constructor(
    private readonly macosSigner: MacosSigner = new MacosSigner(),
    private readonly windowsSigner: WindowsSigner = new WindowsSigner(),
  ) {}

  public async configureOptions(yargs: YargsLike): Promise<void> {
    yargs
      .option("platform", {
        describe: '"macos" or "windows".',
        type: "string",
        demandOption: true,
      })
      .option("identity", {
        describe: 'macOS: code signing identity, e.g. "Developer ID Application: Studio Name (TEAMID)".',
        type: "string",
      })
      .option("entitlementsPath", {
        describe: "macOS: path to an entitlements .plist, if the app needs any.",
        type: "string",
      })
      .option("notarize", {
        describe: "macOS: submit for notarization and staple the ticket after signing. Default true.",
        type: "boolean",
        default: true,
      })
      .option("certificatePath", {
        describe: "Windows: path to a PFX certificate file. Mutually exclusive with certificateThumbprint.",
        type: "string",
      })
      .option("certificateThumbprint", {
        describe: "Windows: thumbprint of a certificate already in the Windows certificate store.",
        type: "string",
      })
      .option("timestampUrl", {
        describe: "Windows: RFC 3161 timestamp server URL. Strongly recommended - without it the signature expires with the certificate.",
        type: "string",
      });
  }

  public async execute(options: SignOptions): Promise<boolean> {
    const buildPath = options.buildPath;
    if (!buildPath) {
      throw new Error("A build path is required: game-ci sign <buildPath>");
    }
    if (!fs.existsSync(buildPath)) {
      throw new Error(`Build path does not exist: ${buildPath}`);
    }

    if (options.platform === "macos") {
      return this.signMacos(buildPath, options);
    }
    if (options.platform === "windows") {
      return this.signWindows(buildPath, options);
    }
    throw new Error(`Unknown --platform "${options.platform}" (expected "macos" or "windows").`);
  }

  private async signMacos(appPath: string, options: SignOptions): Promise<boolean> {
    // Credentials are read directly from the environment here, not
    // threaded through options - never CLI arguments, matching
    // steam-deploy's convention (argv can leak through process listings).
    const identity = options.identity || process.env.APPLE_SIGNING_IDENTITY;
    if (!identity) {
      throw new Error("--identity or $APPLE_SIGNING_IDENTITY is required for macOS signing.");
    }

    console.log(`Signing ${appPath} with identity "${identity}"`);
    const codesignResult = await this.macosSigner.codesign({
      appPath,
      identity,
      entitlementsPath: options.entitlementsPath,
    });
    if (!codesignResult.success) {
      throw new Error(`codesign failed: ${codesignResult.output}`);
    }

    if (options.notarize === false) {
      console.log("Signing succeeded (notarization skipped via --notarize=false).");
      return true;
    }

    const appleId = process.env.APPLE_ID;
    const teamId = process.env.APPLE_TEAM_ID;
    const appSpecificPassword = process.env.APPLE_APP_SPECIFIC_PASSWORD;
    if (!appleId || !teamId || !appSpecificPassword) {
      throw new Error(
        "$APPLE_ID, $APPLE_TEAM_ID, and $APPLE_APP_SPECIFIC_PASSWORD must all be set as environment variables to notarize " +
          "(never as CLI arguments), or pass --notarize=false to sign without notarizing.",
      );
    }

    const zipPath = path.join(os.tmpdir(), `${path.basename(appPath)}-${Date.now()}.zip`);
    const dittoResult = await this.macosSigner.ditto(appPath, zipPath);
    if (!dittoResult.success) {
      throw new Error(`Failed to zip "${appPath}" for notarization: ${dittoResult.output}`);
    }

    console.log("Submitting for notarization (this can take several minutes)...");
    const notarizeResult = await this.macosSigner.notarize({ archivePath: zipPath, appleId, teamId, appSpecificPassword });
    fs.rmSync(zipPath, { force: true });
    if (!notarizeResult.success) {
      throw new Error(`Notarization failed: ${notarizeResult.output}`);
    }

    const stapleResult = await this.macosSigner.staple(appPath);
    if (!stapleResult.success) {
      throw new Error(`Stapling the notarization ticket failed: ${stapleResult.output}`);
    }

    console.log(`Signed and notarized "${appPath}" successfully.`);
    return true;
  }

  private async signWindows(filePath: string, options: SignOptions): Promise<boolean> {
    const certificatePassword = process.env.WINDOWS_CERTIFICATE_PASSWORD;

    if (!options.certificatePath && !options.certificateThumbprint) {
      throw new Error("--certificatePath or --certificateThumbprint is required for Windows signing.");
    }

    console.log(`Signing ${filePath}`);
    const result = await this.windowsSigner.sign({
      filePath,
      certificatePath: options.certificatePath,
      certificatePassword,
      certificateThumbprint: options.certificateThumbprint,
      timestampUrl: options.timestampUrl,
    });

    if (!result.success) {
      throw new Error(`signtool failed: ${result.output}`);
    }

    console.log(`Signed "${filePath}" successfully.`);
    return true;
  }
}
