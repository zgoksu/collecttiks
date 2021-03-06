import express, { Request, Response } from 'express';
import { body } from 'express-validator';
import {
    validateRequest,
    NotFoundError,
    NotAuthorizedError,
    DatabaseConnectionError,
    requireAuth,
    BadRequestError,
} from '@zgoksutickets/common-utils';
import Ticket from '../models/ticket';
import db from 'mongoose';
import { TicketUpdatedPublisher } from '../events/publishers/ticket-updated-publisher';
import { natsWrapper } from '../nats-wrapper';

const router = express.Router();

router.put(
    '/api/tickets/:id',
    requireAuth,
    [
        body('title').notEmpty().withMessage('Title is required'),
        body('price')
            .isFloat({ gt: 0 })
            .withMessage('Price must be provided and must be greater than 0'),
    ],
    validateRequest,
    async (req: Request, res: Response) => {
        const ticket = await Ticket.findById(req.params.id);

        if (!ticket) {
            throw new NotFoundError();
        }

        if (ticket.orderId) {
            throw new BadRequestError('Cannot edit a reserved ticket');
        }

        if (ticket.userId !== req.currentUser!.id) {
            throw new NotAuthorizedError();
        }

        const session = await db.startSession();
        session.startTransaction();

        try {
            ticket.set({
                title: req.body.title,
                price: req.body.price,
            });
            await ticket.save();

            new TicketUpdatedPublisher(natsWrapper.client).publish({
                id: ticket.id!,
                title: ticket.title,
                price: ticket.price,
                userId: ticket.userId,
                version: ticket.version,
            });

            await session.commitTransaction();
            res.send(ticket);
        } catch (err) {
            await session.abortTransaction();
            throw new DatabaseConnectionError();
        }
    }
);

export default router;
