import { Config } from '@remotion/cli/config'

Config.setPublicDir('./out') // the recording, its sounds and the music (see capture/ and music/)
Config.setVideoImageFormat('jpeg')
Config.setJpegQuality(95)
