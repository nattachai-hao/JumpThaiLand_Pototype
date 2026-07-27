const { withPodfile } = require("@expo/config-plugins");

const marker = "# Xcode 26 fmt consteval compatibility";
const anchor = "    # This is necessary for Xcode 14";
const workaround = `    ${marker}
    # React Native 0.79 bundles an older fmt version that fails under Apple
    # Clang from Xcode 26. Compile only the fmt pod as C++17; other pods keep
    # React Native's default C++ standard.
    installer.pods_project.targets.each do |target|
      next unless target.name == 'fmt'

      target.build_configurations.each do |build_config|
        build_config.build_settings['CLANG_CXX_LANGUAGE_STANDARD'] = 'c++17'
      end
    end

`;

module.exports = function withFmtXcode26Fix(config) {
  return withPodfile(config, (podfileConfig) => {
    const contents = podfileConfig.modResults.contents;
    if (contents.includes(marker)) {
      return podfileConfig;
    }
    if (!contents.includes(anchor)) {
      throw new Error("Unable to find the Expo Podfile post_install anchor");
    }

    podfileConfig.modResults.contents = contents.replace(
      anchor,
      `${workaround}${anchor}`,
    );
    return podfileConfig;
  });
};
