# AutoSort+ for Thunderbird

![AutoSort+ Logo](icons/icon-96.png)

AutoSort+ is an intelligent email organization addon for Thunderbird that uses AI to automatically categorize and sort your emails into folders or tags.

## Features

- 🤖 **AI-Powered Classification**: Uses Google's Gemini AI to analyze email content and determine the best category
- 📁 **Smart Folder Organization**: Automatically moves emails to appropriate folders based on AI analysis
- 🏷️ **Tag Support**: Option to add tags instead of moving to folders
- 🎯 **Custom Categories**: Define your own categories and folder structure
- 📊 **Bulk Processing**: Process multiple emails at once
- 🔔 **Real-time Feedback**: Detailed progress notifications during processing
- ⚙️ **Flexible Configuration**: Customize the addon to match your workflow

## Installation

1. Download the latest release from the [Releases](https://github.com/yourusername/AutoSort-Plus/releases) page
2. Open Thunderbird
3. Go to Tools > Add-ons and Themes
4. Click the gear icon and select "Install Add-on From File"
5. Select the downloaded `.xpi` file
6. Restart Thunderbird

## Setup

1. After installation, go to the addon settings:
   - Click the menu button (☰)
   - Select Add-ons and Themes
   - Find AutoSort+ in the list
   - Click the gear icon and select "Options"

2. Configure your Gemini API key:
   - Get an API key from [Google AI Studio](https://makersuite.google.com/app/apikey)
   - Enter the key in the addon settings
   - Test the connection using the "Test API Connection" button

3. Set up your categories:
   - Add custom labels that match your email organization needs
   - Choose between folder move or tag mode
   - Save your settings

## Usage

1. Select one or more emails in your inbox
2. Right-click and choose "AutoSort+ Analyze with AI"
3. The addon will:
   - Analyze the email content
   - Determine the most appropriate category
   - Move the email to the corresponding folder (or apply a tag)
   - Show progress notifications throughout the process

## Folder Structure

AutoSort+ supports the following default category folders:

- Financiën (Finance)
- Werk en Carrière (Work and Career)
- Persoonlijke Communicatie (Personal Communication)
- Gezondheid en Welzijn (Health and Wellness)
- Online Activiteiten (Online Activities)
- Reizen en Evenementen (Travel and Events)
- Informatie en Media (Information and Media)
- Beveiliging en IT (Security and IT)
- Klantensupport (Customer Support)
- Overheid en Gemeenschap (Government and Community)

You can customize these categories in the addon settings.

## Requirements

- Thunderbird 78.0 or later
- Google Gemini API key
- Internet connection for AI analysis

## Development

To build the addon from source:

1. Clone the repository
2. Make your changes to the source files
3. Create an `.xpi` file with the following files:
   - manifest.json
   - background.js
   - content.js
   - options.html
   - options.js
   - styles.css
   - icons/*

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Author

Nigel Hagen

## Support

If you encounter any issues or have questions:
1. Check the [Wiki](https://github.com/yourusername/AutoSort-Plus/wiki)
2. Open an [Issue](https://github.com/yourusername/AutoSort-Plus/issues)
3. Contact the author 