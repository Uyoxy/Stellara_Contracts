import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class I18nMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const langHeader = req.headers['accept-language'];
    const langQuery = req.query['lang'];
    
    // Priority: Query Param > Header > Default 'en'
    let lang = 'en';
    if (typeof langQuery === 'string') {
      lang = langQuery;
    } else if (langHeader) {
      lang = langHeader.split(',')[0].split('-')[0]; // e.g., 'en-US' -> 'en'
    }

    // Attach to request for controllers to use
    req['language'] = lang;
    next();
  }
}