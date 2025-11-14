.#!/bin/bash

# Fast deployment script for Rentat
# Choose between Vercel and Firebase Hosting

echo "🚀 Rentat Deployment Script"
echo "=========================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if build exists
if [ ! -d "dist" ]; then
    echo -e "${YELLOW}📦 Building project...${NC}"
    npm run build
fi

echo -e "${BLUE}Choose deployment method:${NC}"
echo "1) Firebase Hosting (Faster, recommended for static content)"
echo "2) Vercel (Current setup)"
echo "3) Build only (no deployment)"
read -p "Enter choice (1-3): " choice

case $choice in
    1)
        echo -e "${GREEN}🔥 Deploying to Firebase Hosting...${NC}"
        if command -v firebase &> /dev/null; then
            firebase deploy --only hosting
            echo -e "${GREEN}✅ Deployed to Firebase Hosting!${NC}"
        else
            echo -e "${RED}❌ Firebase CLI not found. Install with: npm install -g firebase-tools${NC}"
            exit 1
        fi
        ;;
    2)
        echo -e "${BLUE}▲ Deploying to Vercel...${NC}"
        if command -v vercel &> /dev/null; then
            vercel --prod
            echo -e "${GREEN}✅ Deployed to Vercel!${NC}"
        else
            echo -e "${RED}❌ Vercel CLI not found. Install with: npm install -g vercel${NC}"
            exit 1
        fi
        ;;
    3)
        echo -e "${GREEN}✅ Build completed!${NC}"
        echo -e "${YELLOW}📁 Build output: ./dist${NC}"
        ;;
    *)
        echo -e "${RED}❌ Invalid choice${NC}"
        exit 1
        ;;
esac

echo -e "${GREEN}🎉 Deployment script completed!${NC}"
