import { base64 } from '../../../dependencies.ts';

class UnityLicense {

    private static licenseStartKey = '<DeveloperData Value="';
    private static licenseEndKey = '"/>';
    private static activatedLicenseExtension = '.ulf';
    private static nonActivatedLicenseExtension = '.alf';

    static isNonActivatedLicenseFile(filePath: string) {
      return filePath.endsWith(UnityLicense.nonActivatedLicenseExtension);
    }

    static isValidLicenseFilePath(filePath: string) {
      return filePath.endsWith(UnityLicense.activatedLicenseExtension);
    }

    static isValidLicenseFileContents(fileContents: string) {
      return fileContents.includes(UnityLicense.licenseStartKey);
    }

    static getLicenseSerialFromUlf(fileContents: string) {
        const startIndex = fileContents.indexOf(UnityLicense.licenseStartKey) + UnityLicense.licenseStartKey.length;
        
        if (startIndex < 0) {
          throw new Error(`License File was corrupted, unable to locate serial`);
        }
        
        const endIndex = fileContents.indexOf(UnityLicense.licenseEndKey, startIndex);
        
        if (endIndex < 0) {
          throw new Error(`License File was corrupted, unable to locate serial`);
        }

        // Slice off the first 4 characters as they are garbage values
        return new TextDecoder().decode(base64.decode(fileContents.slice(startIndex, endIndex))).slice(4);
    }
  }
  
  export default UnityLicense;
  