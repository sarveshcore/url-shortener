# URL Shortener Demo with Redis Integration
## Overview
This is a scaled-down demo prototype of a URL shortening application built with Next.js, React, Tailwind CSS, and Redis for caching. The application allows users to shorten URLs and retrieve the original URL using the shortened version. It uses Redis to cache responses for enhanced performance. The project demonstrates server-side rendering (SSR), client-side rendering (CSR), and performance optimizations.
Setup Instructions
To run the application locally, follow these steps after cloning the project folder:

--> Install dependencies:

```npm install```


-->Open a new terminal and start the Redis server:

```redis-server```


-->Run the development server:

```npm run dev```


-->To build the application:

```npm run build```


-->To start the production server:

```npm run start```

This project provides a URL shortening service where users can:

Shorten any given URL.
Use the shortened URL to access the original website.
Retrieve the original URL from a shortened URL.

## The tech stack includes:

Next.js: For server-side and client-side rendering.
React: For building the frontend UI.
Tailwind CSS: For styling.
Redis: For caching API responses.
JavaScript: For application logic.

## Architecture

Next.js Pages: The app uses Next.js for routing and rendering. The homepage (/) is server-side rendered (SSR) to fetch and display recent shortened URLs from Redis.
Redis Cache: Redis stores shortened URL mappings and caches API responses. Each cached entry has a TTL of 48 hours to ensure data freshness.
Frontend: React components handle user input and display results, with Tailwind CSS for responsive styling.

Redis Caching: Stores API responses to reduce redundant calls.
Code Splitting: Next.js automatically splits code by page, reducing bundle size.
Static Assets: Tailwind CSS is purged to minimize CSS size.
Image Optimization: Not applicable for this demo (no images used).




