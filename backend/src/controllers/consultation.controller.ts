import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { symptomService } from '../services/symptom.service';
import { consultationService } from '../services/consultation.service';

export class SymptomController {
  async submitSymptoms(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await symptomService.submitSymptoms(
        req.params.appointmentId as string,
        req.user!.id,
        req.body
      );
      res.status(201).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async getPreVisitSummary(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await symptomService.getPreVisitSummary(
        req.params.appointmentId as string,
        req.user!.id,
        req.user!.role
      );
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
}

export class ConsultationController {
  async submitConsultation(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const consultation = await consultationService.createOrUpdateConsultation(
        req.params.appointmentId as string,
        req.user!.id,
        req.body
      );
      res.status(201).json({ success: true, data: consultation });
    } catch (error) {
      next(error);
    }
  }

  async generatePostVisitSummary(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const summary = await consultationService.generatePostVisitSummary(
        req.params.consultationId as string,
        req.user!.id
      );
      res.json({ success: true, data: summary });
    } catch (error) {
      next(error);
    }
  }

  async getConsultation(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const consultation = await consultationService.getConsultation(
        req.params.consultationId as string,
        req.user!.id,
        req.user!.role
      );
      res.json({ success: true, data: consultation });
    } catch (error) {
      next(error);
    }
  }
}

export const symptomController = new SymptomController();
export const consultationController = new ConsultationController();
