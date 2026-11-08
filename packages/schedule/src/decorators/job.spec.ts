import { Metadata, MetadataKeys } from '@axisparkjs/common';
import { Cron, Interval, Timeout, DateSchedule } from './job';
import { JobType } from '../jobs';

describe('Job decorators', () => {
    beforeEach(() => {
        jest.restoreAllMocks();
    });

    describe('Cron', () => {
        it('should register a cron job', () => {
            const getSpy = jest.spyOn(Metadata, 'get').mockReturnValue(undefined);
            const defineSpy = jest.spyOn(Metadata, 'define').mockImplementation();

            class TestClass {
                @Cron('* * * * *')
                execute() {}
            }

            expect(getSpy).toHaveBeenCalled();

            expect(defineSpy).toHaveBeenCalledWith(
                MetadataKeys.JOB,
                [
                    expect.objectContaining({
                        type: JobType.Cron,
                        value: '* * * * *',
                        name: 'testclass.execute',
                        propertyKey: 'execute',
                        target: TestClass
                    })
                ],
                TestClass.prototype
            );
        });

        it('should use the provided name', () => {
            const defineSpy = jest.spyOn(Metadata, 'define').mockImplementation();

            class TestClass {
                @Cron({
                    value: '* * * * *',
                    name: 'custom-job'
                })
                execute() {}
            }

            expect(defineSpy).toHaveBeenCalledWith(
                MetadataKeys.JOB,
                [
                    expect.objectContaining({
                        name: 'custom-job',
                        type: JobType.Cron
                    })
                ],
                TestClass.prototype
            );
        });
    });

    describe('exclusive', () => {
        it('should keep the exclusive option of the job', () => {
            const defineSpy = jest.spyOn(Metadata, 'define').mockImplementation();

            class TestClass {
                @Cron({ value: '* * * * *', exclusive: true })
                cron() {}
            }

            expect(defineSpy).toHaveBeenCalledWith(MetadataKeys.JOB, [expect.objectContaining({ exclusive: true })], TestClass.prototype);
        });

        it('should keep the exclusive options of the job', () => {
            const defineSpy = jest.spyOn(Metadata, 'define').mockImplementation();

            class TestClass {
                @Interval({ value: 1000, exclusive: { mode: 'no-overlap', ttl: 5000 } })
                interval() {}
            }

            expect(defineSpy).toHaveBeenCalledWith(
                MetadataKeys.JOB,
                [expect.objectContaining({ exclusive: { mode: 'no-overlap', ttl: 5000 } })],
                TestClass.prototype
            );
        });
    });

    describe('Interval', () => {
        it('should register an interval job', () => {
            const defineSpy = jest.spyOn(Metadata, 'define').mockImplementation();

            class TestClass {
                @Interval(5000)
                execute() {}
            }

            expect(defineSpy).toHaveBeenCalledWith(
                MetadataKeys.JOB,
                [
                    expect.objectContaining({
                        type: JobType.Interval,
                        value: 5000
                    })
                ],
                TestClass.prototype
            );
        });

        it('should use the provided name for Interval', () => {
            const defineSpy = jest.spyOn(Metadata, 'define').mockImplementation();

            class TestClass {
                @Interval({
                    value: 10000,
                    name: 'custom-interval'
                })
                execute() {}
            }

            expect(defineSpy).toHaveBeenCalledWith(
                MetadataKeys.JOB,
                [
                    expect.objectContaining({
                        name: 'custom-interval',
                        type: JobType.Interval,
                        value: 10000
                    })
                ],
                TestClass.prototype
            );
        });
    });

    describe('Timeout', () => {
        it('should register a timeout job', () => {
            const defineSpy = jest.spyOn(Metadata, 'define').mockImplementation();

            class TestClass {
                @Timeout(1000)
                execute() {}
            }

            expect(defineSpy).toHaveBeenCalledWith(
                MetadataKeys.JOB,
                [
                    expect.objectContaining({
                        type: JobType.Timeout,
                        value: 1000
                    })
                ],
                TestClass.prototype
            );
        });

        it('should use the provided name for Timeout', () => {
            const defineSpy = jest.spyOn(Metadata, 'define').mockImplementation();

            class TestClass {
                @Timeout({
                    value: 2000,
                    name: 'custom-timeout'
                })
                execute() {}
            }

            expect(defineSpy).toHaveBeenCalledWith(
                MetadataKeys.JOB,
                [
                    expect.objectContaining({
                        name: 'custom-timeout',
                        type: JobType.Timeout,
                        value: 2000
                    })
                ],
                TestClass.prototype
            );
        });
    });

    describe('DateSchedule', () => {
        it('should register a date job', () => {
            const date = new Date('2025-01-01');
            const defineSpy = jest.spyOn(Metadata, 'define').mockImplementation();

            class TestClass {
                @DateSchedule(date)
                execute() {}
            }

            expect(defineSpy).toHaveBeenCalledWith(
                MetadataKeys.JOB,
                [
                    expect.objectContaining({
                        type: JobType.Date,
                        value: date
                    })
                ],
                TestClass.prototype
            );
        });

        it('should use the provided name for DateSchedule', () => {
            const defineSpy = jest.spyOn(Metadata, 'define').mockImplementation();
            const date = new Date();

            class TestClass {
                @DateSchedule({
                    value: date,
                    name: 'custom-date',
                    disabled: true
                })
                execute() {}
            }

            expect(defineSpy).toHaveBeenCalledWith(
                MetadataKeys.JOB,
                [
                    expect.objectContaining({
                        name: 'custom-date',
                        value: date
                    })
                ],
                TestClass.prototype
            );
        });
    });

    it('should append jobs if metadata already exists', () => {
        const existing = [
            {
                name: 'existing',
                type: JobType.Timeout,
                value: 100,
                propertyKey: 'old',
                target: class {}
            }
        ];

        jest.spyOn(Metadata, 'get').mockReturnValue(existing);
        const defineSpy = jest.spyOn(Metadata, 'define').mockImplementation();

        class TestClass {
            @Interval(500)
            execute() {}
        }

        expect(defineSpy).toHaveBeenCalledWith(
            MetadataKeys.JOB,
            expect.arrayContaining([
                existing[0],
                expect.objectContaining({
                    type: JobType.Interval,
                    value: 500
                })
            ]),
            TestClass.prototype
        );
    });
});
