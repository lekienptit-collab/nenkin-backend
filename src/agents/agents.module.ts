import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AgentEntity } from 'src/entities/agent.entity';
import { NenkinProcedureEntity } from 'src/entities/nenkin-procedure.entity';
import { AgentController } from './agents.controller';
import { AgentService } from './services/agents.service';

@Module({
  imports: [TypeOrmModule.forFeature([AgentEntity, NenkinProcedureEntity])],
  controllers: [AgentController],
  providers: [AgentService],
  exports: [AgentService],
})
export class AgentModule {}
