# TerritoryManager

The TerritoryManager is a Power Apps Code App that visualizes customer accounts on an interactive map. It retrieves account data from Dataverse, geocodes their addresses to obtain latitude and longitude coordinates, and displays them as colored circles on a Leaflet-powered map. The size and color of each circle represent the account's revenue, providing a territorial overview for sales and management teams.

## Key Features

- **Automatic Geocoding**: Converts account addresses to map coordinates using OpenStreetMap's Nominatim service
- **Dynamic Visualization**: Circle size and color based on revenue and map zoom level
- **Interactive Popups**: Detailed information for each account including name, address, and revenue
- **Performance Optimized**: Local caching of geocoded locations to minimize API calls
- **Responsive Design**: Adaptive map interface that fits bounds to displayed accounts
- **Data Pagination**: Handles large datasets with efficient pagination support
- **Error Handling**: Graceful handling of missing or invalid location data

## Technology Stack

- **Frontend**: React with TypeScript
- **Build Tool**: Vite
- **Mapping**: Leaflet with React-Leaflet
- **Data Source**: Microsoft Dataverse
- **Styling**: CSS with responsive design
- **Geocoding**: OpenStreetMap Nominatim API

## Getting Started

1. Clone the repository
2. Install dependencies: `npm install`
3. Configure your Dataverse connection in `power.config.json`
4. Build the project: `npm run build`
5. Push to Power Apps: `pac code push`

## Development

- Start development server: `npm run dev`
- Run linting: `npm run lint`
- Build for production: `npm run build`

## Configuration

Update `power.config.json` with your Dataverse environment details and connection references.

<img width="1918" height="867" alt="download (1)" src="https://github.com/user-attachments/assets/10a1ef58-7725-4e29-a00b-bd2969fe879f" />


